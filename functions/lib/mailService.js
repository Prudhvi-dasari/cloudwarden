import { normalizeShareId } from './transferSecurity.js';
import { createResendAdapter } from './resendMail.js';

const RECIPIENT_LIMIT = 10;
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  return `${(size / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function plainText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function applicationOrigin(env) {
  const fallback = 'https://itransfer.iprudhvi.in';
  try {
    const url = new URL(env?.APP_URL || fallback);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export function parseRecipients(value) {
  const seen = new Set();
  const recipients = [];
  let excludedCount = 0;
  for (const part of String(value || '').split(/[,;\s]+/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      excludedCount += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    if (recipients.length >= RECIPIENT_LIMIT) {
      excludedCount += 1;
      continue;
    }
    recipients.push(email);
  }
  return { recipients, excludedCount };
}

async function idempotencyKey(shareId, recipient) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`itransfer-mail:${shareId}:${recipient}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function prepareTransferMail(env, body = {}) {
  const shareId = normalizeShareId(body.shareId);
  const { recipients, excludedCount } = parseRecipients(body.recipientEmails);
  if (!shareId || recipients.length === 0) {
    return { error: 'Missing recipient emails or shareId' };
  }
  const origin = applicationOrigin(env);
  const downloadUrl = `${origin}/d/${shareId}`;
  const sender = plainText(body.senderEmail, 120) || 'Someone';
  const subject = `${sender} sent you files via iTransfer`;
  const note = plainText(body.message, 1000);
  const fileCount = Number(body.fileCount) > 0 ? Math.min(Math.floor(Number(body.fileCount)), 1000) : 1;
  const passwordNotice = body.isPasswordProtected
    ? 'A password is required to download these files.\n\n'
    : '';
  const text = `Files shared with you (${fileCount}, ${formatBytes(body.totalSize)}):\n${downloadUrl}\n\n${passwordNotice}${note}`;
  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return { shareId, recipients, excludedCount, downloadUrl, subject, text, mailtoUrl };
}

export function holdTransferMail(prepared, reason) {
  return fallbackResult(prepared, reason);
}

function fallbackResult(prepared, reason) {
  return {
    success: false,
    status: 'fallback',
    delivery: 'none',
    provider: 'client_fallback',
    reason,
    message: 'Link is ready. Open your mail app to send it.',
    downloadUrl: prepared.downloadUrl,
    recipients: prepared.recipients,
    mailtoUrl: prepared.mailtoUrl,
    dispatchedCount: 0,
    uncertainCount: 0,
    excludedCount: prepared.excludedCount || 0,
  };
}

async function sendWithOneRetry(adapter, message) {
  const first = await adapter.send(message);
  if (first.ok || first.permanent) return first;
  return adapter.send(message);
}

export async function deliverTransferMail(env, prepared, { fetchImpl } = {}) {
  const adapter = createResendAdapter({
    apiKey: env?.RESEND_API_KEY,
    fetchImpl,
  });
  if (!adapter.configured) return fallbackResult(prepared, 'no_smtp_configured');

  const from = plainText(env?.EMAIL_FROM_ADDRESS, 200) || 'iTransfer <send@iprudhvi.in>';
  const counts = { accepted: 0, uncertain: 0, mismatch: 0, timedOut: 0, connection: 0, rejected: 0 };
  for (const recipient of prepared.recipients) {
    const result = await sendWithOneRetry(adapter, {
      from,
      to: recipient,
      subject: prepared.subject,
      text: prepared.text,
      idempotencyKey: await idempotencyKey(prepared.shareId, recipient),
    });
    if (result.ok) counts.accepted += 1;
    else if (result.uncertain) counts.uncertain += 1;
    else if (result.mismatch) counts.mismatch += 1;
    else if (result.timeout) counts.timedOut += 1;
    else if (result.connection) counts.connection += 1;
    else counts.rejected += 1;
  }

  if (counts.accepted === prepared.recipients.length) {
    return {
      success: true,
      status: 'accepted',
      delivery: 'unconfirmed',
      provider: adapter.name,
      dispatchedCount: counts.accepted,
      uncertainCount: 0,
      excludedCount: prepared.excludedCount || 0,
      downloadUrl: prepared.downloadUrl,
    };
  }

  const outcome = classifySendOutcome(counts);
  const definitiveMiss = counts.accepted === 0 && outcome.delivery !== 'unknown';
  return {
    success: false,
    status: outcome.status,
    delivery: outcome.delivery,
    provider: adapter.name,
    reason: outcome.reason,
    dispatchedCount: counts.accepted,
    uncertainCount: counts.uncertain,
    excludedCount: prepared.excludedCount || 0,
    downloadUrl: prepared.downloadUrl,
    ...(definitiveMiss ? {
      message: 'Link is ready. Open your mail app to send it.',
      recipients: prepared.recipients,
      mailtoUrl: prepared.mailtoUrl,
    } : {}),
  };
}

function classifySendOutcome(counts) {
  if (counts.accepted === 0 && counts.uncertain > 0) {
    return { status: 'uncertain', delivery: 'unknown', reason: 'idempotency_in_progress' };
  }
  if (counts.accepted > 0) {
    let reason = 'provider_rejected';
    if (counts.uncertain > 0) reason = 'idempotency_in_progress';
    else if (counts.mismatch > 0) reason = 'idempotency_mismatch';
    else if (counts.timedOut > 0) reason = 'provider_timeout';
    else if (counts.connection > 0) reason = 'connection_failed';
    return { status: 'partial', delivery: 'unconfirmed', reason };
  }
  if (counts.mismatch > 0) {
    return { status: 'idempotency_mismatch', delivery: 'none', reason: 'idempotency_mismatch' };
  }
  if (counts.rejected > 0 && counts.timedOut === 0 && counts.connection === 0) {
    return { status: 'rejected', delivery: 'none', reason: 'provider_rejected' };
  }
  if (counts.timedOut > 0 && counts.connection === 0 && counts.rejected === 0) {
    return { status: 'unavailable', delivery: 'unknown', reason: 'provider_timeout' };
  }
  if (counts.connection > 0 && counts.timedOut === 0 && counts.rejected === 0) {
    return { status: 'unavailable', delivery: 'unknown', reason: 'connection_failed' };
  }
  return { status: 'unavailable', delivery: 'unknown', reason: 'provider_unavailable' };
}
