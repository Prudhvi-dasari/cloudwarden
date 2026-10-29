import { CANONICAL_ORIGIN, publicOrigin } from './canonicalHost.js';
import { normalizeShareId } from './transferSecurity.js';
import { createResendAdapter } from './resendMail.js';
import {
  renderExpiryReminder,
  renderFileRequest,
  renderRecipientTransfer,
  renderSenderConfirmation,
} from './emailTemplates.js';

export {
  buildBaseEmailHtml,
  buildExpiryReminderEmailHtml,
  buildFileRequestEmailHtml,
  buildSenderConfirmationEmailHtml,
  buildTransferEmailHtml,
} from './emailTemplates.js';

const RECIPIENT_LIMIT = 10;
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function plainText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function formatExpiryLabel(expiresAt, expiryHours) {
  const hoursNum = Number(expiryHours);
  if (Number.isFinite(hoursNum) && hoursNum > 0) {
    if (hoursNum <= 24) return `${hoursNum} hour${hoursNum === 1 ? '' : 's'}`;
    const days = Math.round(hoursNum / 24);
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  if (expiresAt) {
    const msLeft = new Date(expiresAt).getTime() - Date.now();
    if (Number.isFinite(msLeft) && msLeft > 0) {
      const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
      if (hoursLeft <= 24) return `${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}`;
      const daysLeft = Math.ceil(hoursLeft / 24);
      return `${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    }
  }
  return 'Up to 7 days';
}

// HTML and plain text are built in emailTemplates.js and re-exported above.

export function applicationOrigin(env) {
  return publicOrigin(env?.APP_URL || CANONICAL_ORIGIN);
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

function idempotencyMaterial(shareId, recipient, eventType) {
  if (eventType === 'sender_confirmation' || eventType === 'file_request' || eventType === 'expiry_reminder') {
    return `itransfer-mail:${eventType}:${shareId}:${recipient}`;
  }
  return `itransfer-mail:${shareId}:${recipient}`;
}

async function idempotencyKey(shareId, recipient, eventType) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(idempotencyMaterial(shareId, recipient, eventType)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const DEFAULT_EMAIL_FROM = 'SendToAnyone <send@sendtoanyone.com>';

function unwrapConfiguredSecret(value) {
  const text = plainText(value, 200);
  if (text.length >= 2) {
    const quote = text[0];
    if ((quote === '"' || quote === "'") && text.endsWith(quote)) return text.slice(1, -1).trim();
  }
  return text;
}

function canonicalizeFromAddress(value) {
  const text = unwrapConfiguredSecret(value);
  if (!text) return '';
  const named = text.match(/^([\s\S]{1,80}?)\s*<([^<>\s]+)>$/);
  if (!named) return text;
  const name = named[1].trim().replace(/\s+/g, ' ');
  const email = named[2].trim();
  if (!name || /[\r\n"]/.test(name) || !EMAIL_PATTERN.test(email) || email.length > 254) return text;
  return `${name} <${email}>`;
}

export function isValidFromAddress(value) {
  const text = String(value || '');
  if (!text || text.length > 200) return false;
  const named = text.match(/^([^<>\r\n"]{1,80}) <([^<>\s]+)>$/);
  if (named) return EMAIL_PATTERN.test(named[2]) && named[2].length <= 254;
  return EMAIL_PATTERN.test(text) && text.length <= 254;
}

export function getEmailFromAddress(env) {
  return canonicalizeFromAddress(env?.EMAIL_FROM_ADDRESS) || DEFAULT_EMAIL_FROM;
}

export function prepareTransferMail(env, body = {}) {
  const shareId = normalizeShareId(body.shareId);
  const { recipients, excludedCount } = parseRecipients(body.recipientEmails);
  if (!shareId || recipients.length === 0) {
    return { error: 'Missing recipient emails or shareId', excludedCount };
  }
  const origin = applicationOrigin(env);
  const downloadUrl = `${origin}/d/${shareId}`;
  const senderRaw = plainText(body.senderEmail, 120);
  const sender = senderRaw || 'Someone';
  const senderIsEmail = EMAIL_PATTERN.test(senderRaw) && senderRaw.length <= 254;
  const replyTo = senderIsEmail
    ? senderRaw.toLowerCase()
    : (EMAIL_PATTERN.test(env?.EMAIL_REPLY_TO) ? env.EMAIL_REPLY_TO.trim() : null);

  const eventType = body.eventType || body.type || 'recipient_transfer';
  const expiryLabel = formatExpiryLabel(body.expiresAt, body.expiryHours);
  const note = plainText(body.message, 1000);
  const isPasswordProtected = Boolean(body.isPasswordProtected);
  const fileCount = Number(body.fileCount) > 0 ? Math.min(Math.floor(Number(body.fileCount)), 1000) : 1;
  const totalSize = body.totalSize;

  let rendered;
  if (eventType === 'sender_confirmation') {
    rendered = renderSenderConfirmation({
      downloadUrl,
      fileCount,
      totalSize,
      origin,
      expiryLabel,
      isPasswordProtected,
    });
  } else if (eventType === 'file_request') {
    rendered = renderFileRequest({
      requester: sender,
      uploadUrl: downloadUrl,
      requestTitle: plainText(body.subject, 120) || 'File request',
      note,
      origin,
      expiryLabel,
    });
  } else if (eventType === 'expiry_reminder') {
    rendered = renderExpiryReminder({
      downloadUrl,
      fileCount,
      totalSize,
      origin,
      expiryLabel,
      isPasswordProtected,
    });
  } else {
    rendered = renderRecipientTransfer({
      sender,
      downloadUrl,
      fileCount,
      totalSize,
      note,
      isPasswordProtected,
      origin,
      expiryLabel,
    });
  }
  const { subject, text, html } = rendered;

  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return { shareId, recipients, excludedCount, downloadUrl, subject, text, html, mailtoUrl, replyTo, eventType };
}

export function holdTransferMail(prepared, reason) {
  return fallbackResult(prepared, reason);
}

function attachCode(result) {
  const basis = result.success ? 'provider_accepted' : (result.reason || result.status || 'unclassified');
  const token = String(basis).toUpperCase();
  result.code = /^[A-Z0-9_]{1,64}$/.test(token) ? token : 'UNCLASSIFIED';
  return result;
}

function fallbackResult(prepared, reason) {
  return attachCode({
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
  });
}

function deliveryResult(prepared, fields) {
  const result = attachCode({
    success: false,
    status: 'rejected',
    delivery: 'none',
    provider: 'resend',
    dispatchedCount: 0,
    uncertainCount: 0,
    excludedCount: prepared?.excludedCount || 0,
    downloadUrl: prepared?.downloadUrl,
    ...fields,
  });
  const definitiveMiss = result.dispatchedCount === 0 && result.delivery !== 'unknown' && result.status !== 'uncertain';
  if (definitiveMiss) {
    result.message = 'Link is ready. Open your mail app to send it.';
    result.recipients = prepared?.recipients;
    result.mailtoUrl = prepared?.mailtoUrl;
  }
  return result;
}

const STOP_RETRY = new Set(['invalid_sender', 'invalid_api_key', 'provider_rejected', 'idempotency_mismatch', 'missing_provider_id']);

async function sendWithOneRetry(adapter, message) {
  const first = await adapter.send(message);
  if (first.ok || first.permanent || first.uncertain || first.missingId || STOP_RETRY.has(first.reason)) return first;
  return adapter.send(message);
}

function countResult(counts, result) {
  if (result.ok && result.providerId) counts.accepted += 1;
  else if (result.missingId) counts.missingId += 1;
  else if (result.uncertain) counts.uncertain += 1;
  else if (result.mismatch) counts.mismatch += 1;
  else if (result.timeout) counts.timedOut += 1;
  else if (result.connection) counts.connection += 1;
  else if (result.reason === 'provider_unavailable') counts.unavailable += 1;
  else counts.rejected += 1;
  if (result.reason === 'invalid_sender' || result.reason === 'invalid_api_key') counts.fatal = result.reason;
}

export async function deliverTransferMail(env, prepared, { fetchImpl } = {}) {
  const safePrepared = prepared && typeof prepared === 'object' ? prepared : {};
  const recipients = Array.isArray(safePrepared.recipients) ? safePrepared.recipients : [];
  const configuredFrom = canonicalizeFromAddress(env?.EMAIL_FROM_ADDRESS);
  const from = configuredFrom || DEFAULT_EMAIL_FROM;
  if (configuredFrom && !isValidFromAddress(from)) {
    return deliveryResult(safePrepared, { reason: 'invalid_sender', provider: 'resend' });
  }
  if (
    recipients.length === 0
    || recipients.length > RECIPIENT_LIMIT
    || recipients.some((recipient) => !EMAIL_PATTERN.test(recipient) || recipient.length > 254)
    || !safePrepared.subject
    || !safePrepared.text
    || !safePrepared.shareId
  ) {
    return deliveryResult(safePrepared, { reason: 'malformed_input', provider: 'none' });
  }

  const adapter = createResendAdapter({
    apiKey: env?.RESEND_API_KEY,
    fetchImpl,
  });
  if (!adapter.configured) return fallbackResult(safePrepared, 'no_smtp_configured');

  const replyTo = EMAIL_PATTERN.test(safePrepared.replyTo || '') && safePrepared.replyTo.length <= 254
    ? safePrepared.replyTo
    : '';
  const counts = {
    accepted: 0,
    uncertain: 0,
    missingId: 0,
    mismatch: 0,
    timedOut: 0,
    connection: 0,
    unavailable: 0,
    rejected: 0,
    fatal: '',
  };
  for (const recipient of recipients) {
    const result = await sendWithOneRetry(adapter, {
      from,
      to: recipient,
      subject: safePrepared.subject,
      text: safePrepared.text,
      html: safePrepared.html,
      ...(replyTo ? { replyTo } : {}),
      idempotencyKey: await idempotencyKey(safePrepared.shareId, recipient, safePrepared.eventType),
    });
    countResult(counts, result);
    if (counts.fatal) break;
  }

  if (counts.accepted === recipients.length) {
    return attachCode({
      success: true,
      status: 'accepted',
      delivery: 'unconfirmed',
      provider: adapter.name,
      dispatchedCount: counts.accepted,
      uncertainCount: 0,
      excludedCount: safePrepared.excludedCount || 0,
      downloadUrl: safePrepared.downloadUrl,
    });
  }

  if (counts.fatal && counts.accepted === 0) {
    return deliveryResult(safePrepared, {
      status: 'rejected',
      delivery: 'none',
      provider: adapter.name,
      reason: counts.fatal,
      dispatchedCount: 0,
      uncertainCount: counts.uncertain,
    });
  }

  const outcome = classifySendOutcome(counts);
  return deliveryResult(safePrepared, {
    status: outcome.status,
    delivery: outcome.delivery,
    provider: adapter.name,
    reason: outcome.reason,
    dispatchedCount: counts.accepted,
    uncertainCount: counts.uncertain + counts.missingId,
  });
}

function classifySendOutcome(counts) {
  if (counts.accepted === 0 && counts.missingId > 0 && counts.rejected === 0 && counts.timedOut === 0 && counts.connection === 0 && counts.unavailable === 0 && counts.mismatch === 0 && counts.uncertain === 0) {
    return { status: 'uncertain', delivery: 'unknown', reason: 'missing_provider_id' };
  }
  if (counts.accepted === 0 && counts.uncertain > 0 && counts.missingId === 0 && counts.rejected === 0 && counts.unavailable === 0) {
    return { status: 'uncertain', delivery: 'unknown', reason: 'idempotency_in_progress' };
  }
  if (counts.accepted > 0) {
    let reason = counts.fatal || 'provider_rejected';
    if (counts.uncertain > 0) reason = 'idempotency_in_progress';
    else if (counts.missingId > 0) reason = 'missing_provider_id';
    else if (counts.mismatch > 0) reason = 'idempotency_mismatch';
    else if (counts.timedOut > 0) reason = 'provider_timeout';
    else if (counts.connection > 0) reason = 'connection_failed';
    else if (counts.unavailable > 0) reason = 'provider_unavailable';
    return { status: 'partial', delivery: 'unconfirmed', reason };
  }
  if (counts.mismatch > 0) {
    return { status: 'idempotency_mismatch', delivery: 'none', reason: 'idempotency_mismatch' };
  }
  if (counts.fatal && counts.timedOut === 0 && counts.connection === 0 && counts.unavailable === 0) {
    return { status: 'rejected', delivery: 'none', reason: counts.fatal };
  }
  if (counts.rejected > 0 && counts.timedOut === 0 && counts.connection === 0 && counts.unavailable === 0 && counts.uncertain === 0 && counts.missingId === 0) {
    return { status: 'rejected', delivery: 'none', reason: 'provider_rejected' };
  }
  if (counts.timedOut > 0 && counts.connection === 0 && counts.rejected === 0 && counts.unavailable === 0) {
    return { status: 'unavailable', delivery: 'unknown', reason: 'provider_timeout' };
  }
  if (counts.connection > 0 && counts.timedOut === 0 && counts.rejected === 0 && counts.unavailable === 0) {
    return { status: 'unavailable', delivery: 'unknown', reason: 'connection_failed' };
  }
  if (counts.unavailable > 0 && counts.rejected === 0 && counts.timedOut === 0 && counts.connection === 0) {
    return { status: 'unavailable', delivery: 'none', reason: 'provider_unavailable' };
  }
  return { status: 'unavailable', delivery: 'unknown', reason: 'provider_unavailable' };
}
