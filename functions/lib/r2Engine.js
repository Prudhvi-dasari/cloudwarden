/**
 * Cloudflare R2 API that runs on Pages Functions (Workers) and Vercel Node.
 * Presigns browser uploads with Web Crypto SigV4 — no AWS SDK, no Node-only modules.
 */

import { allowanceForStatus, STORAGE_POLICY, guestDailyBytes, storageCapBytes } from './storagePolicy.js';
import { SINGLE_PUT_ABANDON_GRACE_SECONDS, UNOCCUPIED_STATUSES } from './transferReservation.js';
import {
  escapeXml,
  mergeCompleteParts,
  multipartIsAbandoned,
  parseIncompleteUploads,
  parseListedParts,
} from './multipartUpload.js';
import { checkSharedLimit, trustedClientIp } from './rateLimit.js';
import { opsEvent } from './opsLog.js';
import { isolatedRuntimeBlock } from './localIsolation.js';
import { previewBlockResponse } from './previewGuard.js';
import {
  expiresAtFromHours,
  generateSecretToken,
  hashPassword,
  normalizeShareId,
  passwordMatches,
  sha256Hex,
  sizeError,
  timingSafeEqual,
} from './transferSecurity.js';

const encoder = new TextEncoder();

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'zsh', 'vbs', 'vbe', 'jse', 'wsf', 'wsh',
  'msc', 'msi', 'msp', 'com', 'scr', 'hta', 'cpl', 'pif', 'reg', 'dll', 'sys',
  'drv', 'ocx', 'ps1', 'ps1xml', 'ps2', 'apk', 'app', 'dmg', 'pkg', 'deb', 'rpm',
]);

const BLOCKED_FILENAMES = new Set([
  '.env', '.env.local', '.env.production', '.git', '.gitignore',
  '.htaccess', '.htpasswd', 'id_rsa', 'id_ed25519', 'authorized_keys',
  'shadow', 'passwd', 'web.config',
]);

// Failure budget shared by verify-password and download-url inside one isolate.
// Both paths ask the shared PASSWORD_LIMIT bucket before comparing a password.
// That bucket is what holds across isolates.
const passwordFailureMap = new Map();
const PASSWORD_FAILURE_LIMIT = 8;
const PASSWORD_FAILURE_WINDOW_MS = 60_000;
const PASSWORD_FAILURE_MAP_MAX = 5000;

const SUPABASE_URL = 'https://giyeepztahdbsejsozog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XenT3T8l2M0-SWsHDJZpUg_3elJqmVU';

function envGet(env, key) {
  if (env && env[key]) return env[key];
  if (env?.ITRANSFER_ISOLATED === '1') return '';
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  return '';
}

function supabaseBase(env) {
  const configured = envGet(env, 'SUPABASE_URL').replace(/\/$/, '');
  if (env?.ITRANSFER_ISOLATED === '1') {
    if (!configured) {
      const error = new Error('Local Supabase URL is not configured.');
      error.code = 'LOCAL_SUPABASE_REQUIRED';
      throw error;
    }
    return configured;
  }
  return configured || SUPABASE_URL;
}

function publishableKey(env) {
  return envGet(env, 'SUPABASE_PUBLISHABLE_KEY')
    || envGet(env, 'SUPABASE_ANON_KEY')
    || (env?.ITRANSFER_ISOLATED === '1' ? '' : SUPABASE_ANON_KEY);
}

function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-Transfer-Password, X-Cleanup-Secret',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

function logDownload(result, category, started) {
  opsEvent({
    event: 'download_authorization',
    result,
    category,
    durationMs: Date.now() - started,
  });
}

function rateLimitDenied(result, error) {
  if (result.allowed) return null;
  opsEvent({
    event: 'rate_limit',
    result: result.blocked ? 'blocked' : 'unavailable',
    category: result.blocked ? 'RATE_LIMITED' : 'RATE_LIMIT_UNAVAILABLE',
  });
  if (result.blocked) return json(429, { error, code: 'RATE_LIMITED' });
  return json(503, { error: 'Rate limit check is unavailable.', code: 'RATE_LIMIT_UNAVAILABLE' });
}

function prunePasswordFailures(now) {
  if (passwordFailureMap.size <= PASSWORD_FAILURE_MAP_MAX) return;
  for (const [key, value] of passwordFailureMap) {
    if (now - value.windowStart > PASSWORD_FAILURE_WINDOW_MS) passwordFailureMap.delete(key);
  }
  if (passwordFailureMap.size <= PASSWORD_FAILURE_MAP_MAX) return;
  const oldest = [...passwordFailureMap.entries()].sort((a, b) => a[1].windowStart - b[1].windowStart);
  const extra = passwordFailureMap.size - PASSWORD_FAILURE_MAP_MAX;
  for (let i = 0; i < extra; i += 1) passwordFailureMap.delete(oldest[i][0]);
}

function currentPasswordFailures(shareId, now = Date.now()) {
  const record = passwordFailureMap.get(shareId);
  if (!record || now - record.windowStart > PASSWORD_FAILURE_WINDOW_MS) return null;
  return record;
}

function rejectIfPasswordFailuresExceeded(shareId) {
  const now = Date.now();
  const record = currentPasswordFailures(shareId, now);
  if (!record || record.count < PASSWORD_FAILURE_LIMIT) return null;
  const retryAfter = Math.max(1, Math.ceil((PASSWORD_FAILURE_WINDOW_MS - (now - record.windowStart)) / 1000));
  return json(429, {
    error: 'Too many password attempts for this transfer.',
    code: 'PASSWORD_RATE_LIMIT',
    retryAfter,
  }, { 'retry-after': String(retryAfter) });
}

async function passwordLimitKey(shareId, clientIp) {
  const scope = shareId || 'invalid-share';
  return sha256Hex(`itransfer-password\n${scope}\n${clientIp}`);
}

function recordPasswordFailure(shareId) {
  const now = Date.now();
  let record = passwordFailureMap.get(shareId);
  if (!record || now - record.windowStart > PASSWORD_FAILURE_WINDOW_MS) {
    record = { windowStart: now, count: 1 };
    passwordFailureMap.set(shareId, record);
    prunePasswordFailures(now);
    return;
  }
  record.count += 1;
}

function isMaliciousFile(fileName = '') {
  if (!fileName || typeof fileName !== 'string') return { isDangerous: true, reason: 'Missing file name.' };
  const baseName = fileName.split('/').pop().split('\\').pop().trim().toLowerCase();
  if (BLOCKED_FILENAMES.has(baseName)) {
    return { isDangerous: true, reason: 'System and configuration files are restricted.' };
  }
  const parts = baseName.split('.');
  const ext = parts.pop();
  const secondLast = parts.length ? parts[parts.length - 1] : '';
  if ((ext && DANGEROUS_EXTENSIONS.has(ext)) || (secondLast && DANGEROUS_EXTENSIONS.has(secondLast))) {
    return { isDangerous: true, reason: `Executable file type (.${ext}) is blocked.` };
  }
  return { isDangerous: false };
}

function sanitizeFileName(fileName = '') {
  const clean = String(fileName)
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, '')
    .replace(/\.\.+/g, '')
    .replace(/[/\\]+/g, '_')
    .replace(/[^\w .-]/gi, '_')
    .trim()
    .replace(/^\.+/, 'file_');
  return (clean || 'file').slice(0, 150);
}

function randomId(length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const payload = typeof data === 'string' ? encoder.encode(data) : data;
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
}

async function signingKey(secret, dateStamp, region) {
  const kDate = await hmac(encoder.encode(`AWS4${secret}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function encodePath(path) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function amzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function configFrom(env) {
  return {
    accountId: envGet(env, 'CLOUDFLARE_R2_ACCOUNT_ID'),
    accessKeyId: envGet(env, 'CLOUDFLARE_R2_ACCESS_KEY_ID'),
    secretAccessKey: envGet(env, 'CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
    bucket: envGet(env, 'CLOUDFLARE_R2_BUCKET') || 'itransfer-storage',
    endpoint: envGet(env, 'CLOUDFLARE_R2_ENDPOINT').trim(),
    region: envGet(env, 'CLOUDFLARE_R2_REGION').trim(),
  };
}

function hostFor(accountId) {
  return `${accountId}.r2.cloudflarestorage.com`;
}

function storageTarget({ accountId, endpoint, region }) {
  if (!endpoint) {
    const host = hostFor(accountId);
    return { origin: `https://${host}`, host, region: 'auto' };
  }
  const url = new URL(endpoint);
  return {
    origin: `${url.protocol}//${url.host}`,
    host: url.host,
    region,
  };
}

async function presign({ accountId, accessKeyId, secretAccessKey, method, path, query = {}, expires = 3600, endpoint, region }) {
  const target = storageTarget({ accountId, endpoint, region });
  const { amzDate, dateStamp } = amzDates();
  const host = target.host;
  const scope = `${dateStamp}/${target.region}/s3/aws4_request`;
  const params = {
    ...query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  const canonicalUri = encodePath(path);
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = toHex(await hmac(await signingKey(secretAccessKey, dateStamp, target.region), stringToSign));
  return `${target.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function signedFetch({ accountId, accessKeyId, secretAccessKey, method, path, query = {}, body = '', contentType, endpoint, region }) {
  const target = storageTarget({ accountId, endpoint, region });
  const { amzDate, dateStamp } = amzDates();
  const host = target.host;
  const scope = `${dateStamp}/${target.region}/s3/aws4_request`;
  const payloadHash = await sha256Hex(body);
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');
  const canonicalUri = encodePath(path);
  const headerLines = [`host:${host}`, `x-amz-content-sha256:${payloadHash}`, `x-amz-date:${amzDate}`];
  if (contentType) headerLines.push(`content-type:${contentType}`);
  headerLines.sort();
  const signedHeaders = headerLines.map((line) => line.split(':')[0]).join(';');
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `${headerLines.join('\n')}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  const signature = toHex(await hmac(await signingKey(secretAccessKey, dateStamp, target.region), stringToSign));
  const headers = {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    host,
  };
  if (contentType) headers['content-type'] = contentType;
  const qs = canonicalQuery ? `?${canonicalQuery}` : '';
  return fetch(`${target.origin}${canonicalUri}${qs}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' || method === 'DELETE' ? undefined : body,
  });
}

function requireConfig(cfg) {
  if (!cfg.accountId || !cfg.accessKeyId || !cfg.secretAccessKey) {
    return json(503, {
      error: 'Cloudflare R2 is not configured on this deployment.',
      configured: false,
    });
  }
  if (cfg.endpoint) {
    try {
      const url = new URL(cfg.endpoint);
      if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.host) {
        return json(503, { error: 'Object storage endpoint is invalid.', code: 'STORAGE_ENDPOINT_INVALID' });
      }
    } catch {
      return json(503, { error: 'Object storage endpoint is invalid.', code: 'STORAGE_ENDPOINT_INVALID' });
    }
    if (!cfg.region || cfg.region === 'auto') {
      return json(503, {
        error: 'A signing region is required when an object storage endpoint is set.',
        code: 'STORAGE_REGION_REQUIRED',
      });
    }
  }
  return null;
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return {};
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function requireCleanupSecret(request, env) {
  const secret = envGet(env, 'CLEANUP_SECRET');
  if (!secret) return json(503, { error: 'Cleanup is not configured.', code: 'CLEANUP_UNCONFIGURED' });
  const provided = request.headers.get('x-cleanup-secret') || '';
  if (!timingSafeEqual(provided, secret)) return json(401, { error: 'Unauthorized.', code: 'UNAUTHORIZED' });
  return null;
}

function dbErrorResponse(err) {
  if (err?.code === 'NO_SERVICE_ROLE') {
    return json(503, { error: 'Storage records are not configured.', code: 'NO_SERVICE_ROLE' });
  }
  if (err?.status === 409 || err?.code === '23505') {
    return json(409, { error: 'This transfer was already opened.', code: 'ALREADY_OPENED' });
  }
  return json(503, { error: 'Could not record this transfer.', code: 'RECORD_FAILED' });
}

async function sbFetch(env, path, { method = 'GET', body } = {}) {
  const key = envGet(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!key) {
    const error = new Error('Storage records are not configured.');
    error.code = 'NO_SERVICE_ROLE';
    throw error;
  }
  const base = supabaseBase(env);
  const res = await fetch(`${base}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }
  if (!res.ok) {
    const error = new Error(data?.message || data?.error || `Database error ${res.status}`);
    error.status = res.status;
    error.code = data?.code || '';
    throw error;
  }
  return data;
}

const ADMIN_EMAILS = new Set([
  'iprudhvichowdary@gmail.com',
  'send@iprudhvi.in',
]);

const SHARE_COLUMNS = [
  'id', 'share_id', 'file_name', 'file_size', 'content_type', 'subject', 'message',
  'sender_email', 'recipient_emails', 'expires_at', 'status', 'password_hash',
  'max_downloads', 'download_count', 'transfer_type', 'user_id', 'created_at',
].join(',');

function isFileId(value) {
  return /^[A-Za-z0-9-]{4,80}$/.test(String(value || ''));
}

function normalizeRequestId(value) {
  const requestId = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{4,80}$/.test(requestId)) return null;
  return requestId;
}

async function authUser(request, env) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)/i);
  if (!match) return { id: null, email: '' };
  const base = supabaseBase(env);
  const res = await fetch(`${base}/auth/v1/user`, {
    headers: {
      apikey: publishableKey(env),
      Authorization: `Bearer ${match[1]}`,
    },
  });
  if (!res.ok) return { invalid: true };
  const body = await res.json().catch(() => ({}));
  if (!body?.id || typeof body.id !== 'string') return { invalid: true };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  return { id: body.id, email };
}

async function findClaim(env, token, purpose) {
  if (!token || typeof token !== 'string' || token.length < 32) return null;
  const hash = await sha256Hex(token);
  const rows = await sbFetch(
    env,
    `transfer_claims?token_hash=eq.${encodeURIComponent(hash)}&purpose=eq.${purpose}&select=id,share_id,purpose,token_hash,expires_at,used_at&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

function claimUsable(claim) {
  if (!claim) return { ok: false, status: 401, error: 'This token is not valid.', code: 'TOKEN_INVALID' };
  if (claim.used_at) return { ok: false, status: 401, error: 'This token has already been used.', code: 'TOKEN_USED' };
  if (claim.expires_at && new Date(claim.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 401, error: 'This token has expired.', code: 'TOKEN_EXPIRED' };
  }
  return { ok: true };
}

function safeCleanupKey(value) {
  const key = String(value || '').trim();
  if (!key || key.includes('..') || key.includes('\\')) return '';
  if (!key.startsWith('transfers/') && !key.startsWith('requests/')) return '';
  return key;
}

async function markCleanupStatus(env, id, status) {
  if (!id) {
    const error = new Error('Cleanup could not identify the transfer row.');
    error.status = 503;
    error.code = 'CLEANUP_RECORD_FAILED';
    throw error;
  }
  const updated = await sbFetch(env, `transfers?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status },
  });
  if (!Array.isArray(updated) || updated.length !== 1) {
    const error = new Error('Cleanup could not update the transfer row.');
    error.status = 503;
    error.code = 'CLEANUP_RECORD_FAILED';
    throw error;
  }
}

function nextListToken(xml) {
  if (!/<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(String(xml || ''))) return '';
  return String(xml).match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] || '';
}

async function loadTransferByPath(env, s3Key) {
  const rows = await sbFetch(
    env,
    `transfers?file_path=eq.${encodeURIComponent(s3Key)}&select=share_id,file_path,file_size,expires_at,status,password_hash,user_id,multipart_upload_id&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

function transferState(row) {
  const status = row?.status || 'active';
  if (UNOCCUPIED_STATUSES.has(status)) return 'expired';
  if (row?.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  if (status !== 'active') return 'pending';
  return 'active';
}

function textField(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  return String(value);
}

function publicFile(row) {
  return {
    id: row.id,
    fileName: row.file_name,
    fileSize: Number(row.file_size || 0),
    contentType: row.content_type || 'application/octet-stream',
    downloadCount: Number(row.download_count || 0),
    maxDownloads: Number(row.max_downloads || 0),
  };
}

function publicShare(shareId, rows) {
  const first = rows[0] || {};
  const files = rows.map(publicFile);
  return {
    shareId,
    subject: first.subject || null,
    message: first.message || null,
    senderEmail: first.sender_email || null,
    expiresAt: first.expires_at || null,
    passwordRequired: rows.some((row) => Boolean(row.password_hash)),
    maxDownloads: Number(first.max_downloads || 0),
    downloadCount: rows.reduce((sum, row) => sum + Number(row.download_count || 0), 0),
    totalSize: files.reduce((sum, file) => sum + file.fileSize, 0),
    fileCount: files.length,
    files,
  };
}

function ownerTransfer(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (row.status === 'released') continue;
    if (!grouped.has(row.share_id)) {
      grouped.set(row.share_id, {
        shareId: row.share_id,
        createdAt: row.created_at || null,
        expiresAt: row.expires_at || null,
        subject: row.subject || null,
        message: row.message || null,
        passwordRequired: false,
        transferType: row.transfer_type || 'link',
        senderEmail: row.sender_email || null,
        recipientEmails: textField(row.recipient_emails),
        files: [],
        totalSize: 0,
        downloadCount: 0,
        maxDownloads: Number(row.max_downloads || 0),
        status: row.status || 'active',
      });
    }
    const group = grouped.get(row.share_id);
    if (row.password_hash) group.passwordRequired = true;
    group.files.push({
      id: row.id,
      name: row.file_name,
      size: Number(row.file_size || 0),
      type: row.content_type || 'application/octet-stream',
      downloadCount: Number(row.download_count || 0),
      maxDownloads: Number(row.max_downloads || 0),
    });
    group.totalSize += Number(row.file_size || 0);
    group.downloadCount += Number(row.download_count || 0);
    group.expiredFiles = (group.expiredFiles || 0) + ((row.status || 'active') === 'expired' ? 1 : 0);
    group.status = group.expiredFiles === group.files.length ? 'expired' : 'active';
  }
  return [...grouped.values()].map(({ expiredFiles, ...transfer }) => transfer);
}

async function loadFileRequest(env, requestId) {
  const rows = await sbFetch(
    env,
    `file_requests?request_id=eq.${encodeURIComponent(requestId)}&select=request_id,title,instructions,status,expires_at,owner_user_id,created_at&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

function requestOpen(row) {
  if (!row || row.status !== 'active') return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false;
  return true;
}

async function transferCapFor(env, userId) {
  const free = allowanceForStatus('');
  if (!userId) return free;
  try {
    const rows = await sbFetch(
      env,
      `billing_entitlements?user_id=eq.${encodeURIComponent(userId)}&select=status&limit=1`,
    );
    const status = Array.isArray(rows) ? rows[0]?.status : '';
    return allowanceForStatus(status);
  } catch {
    return free;
  }
}

function reservationPayload(result) {
  return Array.isArray(result) ? result[0] : result;
}

async function syncStorageCap(env) {
  try {
    await sbFetch(env, 'rpc/set_platform_storage_cap', {
      method: 'POST',
      body: { p_cap: storageCapBytes(env) },
    });
  } catch {
    // The settings function arrives with the 2 TB migration.
  }
}

async function dailyUploadSubject(request) {
  const ip = trustedClientIp(request) || 'unknown';
  const digest = await sha256Hex(String(ip));
  return `ip:${digest.slice(0, 32)}`;
}

async function consumeDailyUpload(env, request, paid, fileSize) {
  if (paid) return null;
  const subject = await dailyUploadSubject(request);
  let payload;
  try {
    payload = reservationPayload(await sbFetch(env, 'rpc/consume_daily_upload', {
      method: 'POST',
      body: {
        p_subject: subject,
        p_bytes: Number(fileSize) || 0,
        p_limit: guestDailyBytes(env),
      },
    }));
  } catch {
    return null;
  }
  if (payload?.ok === false) {
    return {
      blocked: json(403, {
        error: 'This network has sent as much as it can on the free plan today. Try again tomorrow, or use Pro.',
        code: 'DAILY_LIMIT',
      }),
    };
  }
  return { subject, bytes: Number(fileSize) || 0 };
}

async function releaseDailyUpload(env, hold) {
  if (!hold?.subject || !hold.bytes) return;
  try {
    await sbFetch(env, 'rpc/release_daily_upload', {
      method: 'POST',
      body: { p_subject: hold.subject, p_bytes: hold.bytes },
    });
  } catch {
    // Best effort. The 24 hour window still resets the counter.
  }
}

async function reserveTransferRow(env, row, request) {
  await syncStorageCap(env);
  const allowance = await transferCapFor(env, row?.p_user_id || null);
  const daily = await consumeDailyUpload(env, request, allowance.paid, row?.p_file_size);
  if (daily?.blocked) return daily.blocked;
  let result;
  try {
    result = await sbFetch(env, 'rpc/reserve_transfer_file', {
      method: 'POST',
      body: row,
    });
  } catch (error) {
    await releaseDailyUpload(env, daily);
    throw error;
  }
  const payload = reservationPayload(result);
  if (payload?.ok === true) return null;
  await releaseDailyUpload(env, daily);
  opsEvent({
    event: 'reservation',
    result: 'rejected',
    category: payload?.code === 'TRANSFER_TOO_LARGE' || payload?.code === 'STORAGE_CAP' || payload?.code === 'STORAGE_BUSY'
      ? payload.code
      : 'RECORD_FAILED',
  });
  if (payload?.code === 'TRANSFER_TOO_LARGE') {
    return json(403, {
      error: allowance.paid
        ? 'This transfer is larger than the 250 GB limit.'
        : 'This transfer is larger than the 6 GB free limit.',
      code: 'TRANSFER_TOO_LARGE',
    });
  }
  if (payload?.code === 'STORAGE_BUSY') {
    return json(403, {
      error: 'Free sends are paused because storage is almost full. A Pro account can still send.',
      code: 'STORAGE_BUSY',
    });
  }
  if (payload?.code === 'STORAGE_CAP') {
    return json(403, {
      error: 'SendToAnyone is full right now. Files that expire free up space, so try again a little later.',
      code: 'STORAGE_CAP',
    });
  }
  return json(503, { error: 'Could not record this transfer.', code: 'RECORD_FAILED' });
}

async function releaseReservation(env, filePath) {
  await sbFetch(env, `transfers?file_path=eq.${encodeURIComponent(filePath)}&status=eq.pending`, {
    method: 'PATCH',
    body: { status: 'rejected' },
  }).catch(() => {});
}

function reservationArgs({ claim, owner, body, key, safeName, passwordHash, requestId }) {
  return {
    p_share_id: claim.share_id,
    p_file_name: safeName,
    p_file_size: Number(body.fileSize),
    p_file_path: key,
    p_content_type: body.contentType || 'application/octet-stream',
    p_subject: body.subject || null,
    p_message: body.message || null,
    p_sender_email: body.senderEmail || null,
    p_recipient_emails: body.recipientEmails || null,
    p_request_id: requestId || null,
    p_password_hash: passwordHash,
    p_user_id: owner.id,
    p_transfer_type: body.transferType || 'link',
    p_max_downloads: Number(body.maxDownloads) > 0 ? Number(body.maxDownloads) : 0,
    p_expires_at: claim.expires_at,
    p_storage_provider: 'r2',
  };
}

async function requireOpenRequest(env, rawRequestId) {
  if (!rawRequestId) return { requestId: null };
  const requestId = normalizeRequestId(rawRequestId);
  if (!requestId) return { error: json(400, { error: 'That request link is not valid.', code: 'REQUEST_INVALID' }) };
  const portal = await loadFileRequest(env, requestId);
  if (!portal) return { error: json(404, { error: 'That request link was not found.', code: 'REQUEST_NOT_FOUND' }) };
  if (!requestOpen(portal)) return { error: json(410, { error: 'That request link is no longer accepting files.', code: 'REQUEST_CLOSED' }) };
  return { requestId };
}

async function loadShareRows(env, shareId) {
  const rows = await sbFetch(
    env,
    `transfers?share_id=eq.${encodeURIComponent(shareId)}&select=${SHARE_COLUMNS}`,
  );
  return Array.isArray(rows) ? rows : [];
}

async function activateObject(env, cfg, { s3Key, claim }) {
  const row = await loadTransferByPath(env, s3Key);
  if (!row || row.share_id !== claim.share_id) {
    return json(404, { error: 'That upload was not found.', code: 'NOT_FOUND' });
  }
  const head = await signedFetch({ ...cfg, method: 'HEAD', path: `/${cfg.bucket}/${s3Key}` });
  if (!head.ok) {
    opsEvent({ event: 'upload', result: 'rejected', category: 'VERIFY_FAILED' });
    return json(502, { error: 'The uploaded object could not be verified.', code: 'VERIFY_FAILED' });
  }
  const actual = Number(head.headers.get('content-length') || 0);
  const declared = Number(row.file_size || 0);
  const cap = await transferCapFor(env, row.user_id);
  if (!actual || actual !== declared || actual > cap.bytes) {
    await signedFetch({ ...cfg, method: 'DELETE', path: `/${cfg.bucket}/${s3Key}` }).catch(() => {});
    await sbFetch(env, `transfers?file_path=eq.${encodeURIComponent(s3Key)}`, {
      method: 'PATCH',
      body: { status: 'rejected' },
    }).catch(() => {});
    opsEvent({ event: 'upload', result: 'rejected', category: 'SIZE_MISMATCH' });
    return json(403, { error: 'The uploaded file does not match the allowed size.', code: 'SIZE_MISMATCH' });
  }
  await sbFetch(env, `transfers?file_path=eq.${encodeURIComponent(s3Key)}`, {
    method: 'PATCH',
    body: { status: 'active' },
  });
  opsEvent({ event: 'upload', result: 'activated', category: 'OBJECT_READY' });
  return json(200, { s3Key, shareId: row.share_id, status: 'active' });
}

async function requireDeleteClaim(env, token) {
  const claim = await findClaim(env, token, 'delete');
  const usable = claimUsable(claim);
  if (!usable.ok) return { error: json(usable.status, { error: usable.error, code: usable.code }) };
  return { claim };
}

async function listUploadedParts(cfg, key, uploadId) {
  const res = await signedFetch({
    ...cfg,
    method: 'GET',
    path: `/${cfg.bucket}/${key}`,
    query: { uploadId, 'max-parts': '1000' },
  });
  if (!res.ok) return [];
  return parseListedParts(await res.text());
}

async function optionalOwner(request, env) {
  const header = request.headers.get('authorization') || '';
  if (!header) return { id: null };
  const user = await authUser(request, env);
  if (user.invalid || !user.id) return { error: json(401, { error: 'Sign-in could not be verified.', code: 'AUTH_INVALID' }) };
  return user;
}

function uploadsPaused(env) {
  const value = String(env?.UPLOADS_PAUSED || '').trim().toLowerCase();
  return value === '1' || value === 'true';
}

function uploadPauseResponse() {
  return json(503, {
    error: 'New uploads are temporarily paused.',
    code: 'UPLOADS_PAUSED',
  });
}

export async function handleR2Request({ request, env }) {
  if (request.method === 'OPTIONS') return json(200, { ok: true });
  const isolatedBlock = isolatedRuntimeBlock(env);
  if (isolatedBlock) return json(isolatedBlock.status, isolatedBlock.body);
  const previewBlock = previewBlockResponse(request, env);
  if (previewBlock) return previewBlock;

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'health';
  const cfg = configFrom(env);
  const clientIp = trustedClientIp(request);

  try {
    if (action === 'health') {
      const configured = Boolean(cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey);
      return json(200, {
        status: configured ? 'active' : 'unconfigured',
        provider: 'Cloudflare R2',
        bucket: cfg.bucket,
        runtime: 'workers',
        zeroEgress: true,
        configured,
      });
    }

    if (action === 'tier-limits') {
      const owner = await optionalOwner(request, env);
      if (owner.error) return owner.error;
      const allowance = await transferCapFor(env, owner.id);
      return json(200, {
        paidFeaturesEnabled: STORAGE_POLICY.paidFeaturesEnabled,
        paid: allowance.paid,
        maxFileSizeBytes: allowance.bytes,
        maxRetentionHours: allowance.hours,
        tiers: {
          free: {
            name: 'Free',
            maxFileSizeGB: STORAGE_POLICY.freeTransferBytes / 1_000_000_000,
            maxRetentionDays: STORAGE_POLICY.freeRetentionHours / 24,
            permanentAllowed: false,
          },
          paid: {
            name: 'Paid',
            maxFileSizeGB: STORAGE_POLICY.paidTransferBytes / 1_000_000_000,
            maxRetentionDays: STORAGE_POLICY.paidRetentionHours / 24,
            permanentAllowed: false,
          },
        },
      });
    }

    if (action === 'open-transfer' && request.method === 'POST') {
      if (uploadsPaused(env)) return uploadPauseResponse();
      const denied = rateLimitDenied(await checkSharedLimit(env, 'upload', clientIp), 'Upload rate limit reached.');
      if (denied) return denied;
      const owner = await optionalOwner(request, env);
      if (owner.error) return owner.error;
      const body = await readBody(request);
      const allowance = await transferCapFor(env, owner.id);
      const shareId = normalizeShareId(body.shareId) || randomId(10);
      const claimToken = generateSecretToken();
      const deleteToken = generateSecretToken();
      const expiresAt = expiresAtFromHours(body.expiryHours, Date.now(), allowance.hours);
      await sbFetch(env, 'transfer_claims', {
        method: 'POST',
        body: [
          { share_id: shareId, purpose: 'claim', token_hash: await sha256Hex(claimToken), expires_at: expiresAt },
          { share_id: shareId, purpose: 'delete', token_hash: await sha256Hex(deleteToken), expires_at: expiresAt },
        ],
      });
      return json(200, {
        shareId,
        expiresAt,
        claimToken,
        deleteToken,
        paidFeaturesEnabled: allowance.paid,
        ownerId: owner.id,
      });
    }

    if (action === 'get-put-url' && request.method === 'POST') {
      const started = Date.now();
      if (uploadsPaused(env)) return uploadPauseResponse();
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const denied = rateLimitDenied(await checkSharedLimit(env, 'upload', clientIp), 'Upload rate limit reached.');
      if (denied) return denied;
      const owner = await optionalOwner(request, env);
      if (owner.error) return owner.error;
      const body = await readBody(request);
      const allowance = await transferCapFor(env, owner.id);
      const tooBig = sizeError(body.fileSize, allowance.bytes);
      if (tooBig) return json(403, { error: tooBig, code: 'TRANSFER_TOO_LARGE' });
      const malware = isMaliciousFile(body.fileName);
      if (malware.isDangerous) return json(400, { error: malware.reason, code: 'MALICIOUS_FILE_BLOCKED' });
      const gate = await requireDeleteClaim(env, body.deleteToken);
      if (gate.error) return gate.error;
      const portal = await requireOpenRequest(env, body.requestId);
      if (portal.error) return portal.error;
      const safeName = sanitizeFileName(body.fileName);
      const key = `transfers/${Date.now()}-${randomId(8)}/${safeName}`;
      const passwordHash = await hashPassword(body.password);
      const reserved = await reserveTransferRow(env, reservationArgs({
        claim: gate.claim,
        owner,
        body,
        key,
        safeName,
        passwordHash,
        requestId: portal.requestId,
      }), request);
      if (reserved) return reserved;
      const presignedUrl = await presign({
        ...cfg,
        method: 'PUT',
        path: `/${cfg.bucket}/${key}`,
        expires: STORAGE_POLICY.uploadUrlSeconds,
      });
      opsEvent({ event: 'upload', result: 'url_issued', category: 'SINGLE_PUT', durationMs: Date.now() - started });
      return json(200, {
        presignedUrl,
        s3Key: key,
        shareId: gate.claim.share_id,
        safeFileName: safeName,
        bucket: cfg.bucket,
        expiresAt: gate.claim.expires_at,
      });
    }

    if (action === 'refresh-put-url' && request.method === 'POST') {
      if (uploadsPaused(env)) return uploadPauseResponse();
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const body = await readBody(request);
      if (!body.s3Key?.startsWith('transfers/') || body.s3Key.includes('..')) {
        return json(400, { error: 'Invalid storage key.' });
      }
      const gate = await requireDeleteClaim(env, body.deleteToken);
      if (gate.error) return gate.error;
      const pending = await loadTransferByPath(env, body.s3Key);
      if (!pending || pending.share_id !== gate.claim.share_id || pending.status !== 'pending' || pending.multipart_upload_id) {
        return json(403, { error: 'That upload session is not valid.', code: 'UPLOAD_NOT_AUTHORIZED' });
      }
      const presignedUrl = await presign({
        ...cfg,
        method: 'PUT',
        path: `/${cfg.bucket}/${body.s3Key}`,
        expires: STORAGE_POLICY.uploadUrlSeconds,
      });
      return json(200, { presignedUrl, s3Key: body.s3Key, shareId: pending.share_id });
    }

    if (action === 'request-meta') {
      const denied = rateLimitDenied(await checkSharedLimit(env, 'download', clientIp), 'Too many requests.');
      if (denied) return denied;
      const requestId = normalizeRequestId(url.searchParams.get('requestId'));
      if (!requestId) return json(400, { error: 'A valid request id is required.', code: 'REQUEST_INVALID' });
      const portal = await loadFileRequest(env, requestId);
      if (!portal) return json(404, { error: 'That request link was not found.', code: 'REQUEST_NOT_FOUND' });
      if (!requestOpen(portal)) {
        return json(410, {
          error: 'That request link is no longer accepting files.',
          code: 'REQUEST_CLOSED',
          title: portal.title || 'File request',
          expiresAt: portal.expires_at || null,
        });
      }
      return json(200, {
        requestId: portal.request_id,
        title: portal.title || 'File request',
        instructions: portal.instructions || null,
        expiresAt: portal.expires_at || null,
      });
    }

    if (action === 'create-request' && request.method === 'POST') {
      const user = await authUser(request, env);
      if (user.invalid || !user.id) return json(401, { error: 'Sign in to create a request link.', code: 'AUTH_REQUIRED' });
      if (!/^[0-9a-f-]{36}$/i.test(user.id)) return json(401, { error: 'Sign-in could not be verified.', code: 'AUTH_INVALID' });
      const denied = rateLimitDenied(await checkSharedLimit(env, 'request', user.id), 'Too many request links.');
      if (denied) return denied;
      const body = await readBody(request);
      const title = String(body.title || '').trim().slice(0, 120) || 'File request';
      const instructions = String(body.instructions || '').trim().slice(0, 500) || null;
      const requestId = `req-${randomId(8)}`;
      const expiresAt = expiresAtFromHours(168);
      await sbFetch(env, 'file_requests', {
        method: 'POST',
        body: {
          request_id: requestId,
          owner_user_id: user.id,
          owner_email: user.email || null,
          title,
          instructions,
          status: 'active',
          expires_at: expiresAt,
        },
      });
      return json(200, { requestId, title, instructions, expiresAt });
    }

    if (action === 'close-request' && request.method === 'POST') {
      const user = await authUser(request, env);
      if (user.invalid || !user.id) return json(401, { error: 'Sign in to close a request link.', code: 'AUTH_REQUIRED' });
      const body = await readBody(request);
      const requestId = normalizeRequestId(body.requestId);
      if (!requestId) return json(400, { error: 'A valid request id is required.', code: 'REQUEST_INVALID' });
      const updated = await sbFetch(
        env,
        `file_requests?request_id=eq.${encodeURIComponent(requestId)}&owner_user_id=eq.${encodeURIComponent(user.id)}`,
        { method: 'PATCH', body: { status: 'closed' } },
      );
      if (!Array.isArray(updated) || updated.length === 0) {
        return json(403, { error: 'You can only close your own request links.', code: 'REQUEST_FORBIDDEN' });
      }
      return json(200, { ok: true, requestId, status: 'closed' });
    }

    if (action === 'my-requests') {
      const user = await authUser(request, env);
      if (user.invalid || !user.id) return json(401, { error: 'Sign in to view request links.', code: 'AUTH_REQUIRED' });
      const portals = await sbFetch(
        env,
        `file_requests?owner_user_id=eq.${encodeURIComponent(user.id)}&select=request_id,title,instructions,status,expires_at,created_at&order=created_at.desc&limit=50`,
      );
      const owned = Array.isArray(portals) ? portals : [];
      const ids = owned.map((row) => row.request_id).filter(Boolean);
      let received = [];
      if (ids.length > 0) {
        const list = ids.map((id) => encodeURIComponent(id)).join(',');
        const rows = await sbFetch(
          env,
          `transfers?request_id=in.(${list})&select=share_id,request_id,file_name,file_size,created_at,expires_at,sender_email,subject,status&order=created_at.desc&limit=100`,
        );
        received = Array.isArray(rows) ? rows : [];
      }
      return json(200, {
        requests: owned.map((portal) => {
          const files = received.filter((row) => row.request_id === portal.request_id);
          const shares = new Map();
          for (const row of files) {
            if (UNOCCUPIED_STATUSES.has(row.status || 'active')) continue;
            if (!shares.has(row.share_id)) {
              shares.set(row.share_id, {
                shareId: row.share_id,
                subject: row.subject || null,
                senderEmail: row.sender_email || null,
                createdAt: row.created_at || null,
                expiresAt: row.expires_at || null,
                status: row.status || 'active',
                fileCount: 0,
                totalSize: 0,
              });
            }
            const group = shares.get(row.share_id);
            group.fileCount += 1;
            group.totalSize += Number(row.file_size || 0);
          }
          return {
            requestId: portal.request_id,
            title: portal.title,
            instructions: portal.instructions || null,
            status: portal.status,
            expiresAt: portal.expires_at,
            createdAt: portal.created_at,
            received: [...shares.values()],
          };
        }),
      });
    }

    if (action === 'share-meta') {
      const denied = rateLimitDenied(await checkSharedLimit(env, 'download', clientIp), 'Download rate limit reached.');
      if (denied) return denied;
      const shareId = normalizeShareId(url.searchParams.get('shareId'));
      if (!shareId) return json(400, { error: 'A valid share id is required.', code: 'SHARE_INVALID' });
      const rows = await loadShareRows(env, shareId);
      if (rows.length === 0) return json(404, { error: 'This transfer was not found.', code: 'NOT_FOUND' });
      const states = rows.map(transferState);
      if (states.every((state) => state === 'expired')) {
        const expired = publicShare(shareId, rows);
        return json(410, {
          error: 'This transfer has expired.',
          code: 'EXPIRED',
          subject: expired.subject,
          fileCount: expired.fileCount,
          totalSize: expired.totalSize,
          expiresAt: expired.expiresAt,
        });
      }
      const active = rows.filter((row) => transferState(row) === 'active');
      if (active.length === 0) return json(409, { error: 'This transfer is not ready.', code: 'NOT_READY' });
      return json(200, publicShare(shareId, active));
    }

    if (action === 'my-transfers') {
      const user = await authUser(request, env);
      if (user.invalid || !user.id) return json(401, { error: 'Sign in to view your transfers.', code: 'AUTH_REQUIRED' });
      if (!/^[0-9a-f-]{36}$/i.test(user.id)) return json(401, { error: 'Sign-in could not be verified.', code: 'AUTH_INVALID' });
      const owned = await sbFetch(
        env,
        `transfers?user_id=eq.${encodeURIComponent(user.id)}&select=${SHARE_COLUMNS}&order=created_at.desc&limit=50`,
      );
      let guestRows = [];
      if (user.email && !/[%_*]/.test(user.email)) {
        guestRows = await sbFetch(
          env,
          `transfers?user_id=is.null&sender_email=eq.${encodeURIComponent(user.email)}&select=${SHARE_COLUMNS}&order=created_at.desc&limit=50`,
        );
      }
      const merged = new Map();
      for (const row of [...(Array.isArray(owned) ? owned : []), ...(Array.isArray(guestRows) ? guestRows : [])]) {
        if (row?.id) merged.set(row.id, row);
      }
      return json(200, { transfers: ownerTransfer([...merged.values()]) });
    }

    if (action === 'rename-transfer' && request.method === 'POST') {
      const user = await authUser(request, env);
      if (user.invalid || !user.id) return json(401, { error: 'Sign in to rename a transfer.', code: 'AUTH_REQUIRED' });
      if (!/^[0-9a-f-]{36}$/i.test(user.id)) return json(401, { error: 'Sign-in could not be verified.', code: 'AUTH_INVALID' });
      const body = await readBody(request);
      const shareId = normalizeShareId(body.shareId);
      const subject = String(body.subject || '').trim().slice(0, 200);
      if (!shareId || !subject) return json(400, { error: 'A share id and name are required.', code: 'RENAME_INVALID' });
      let updated = await sbFetch(
        env,
        `transfers?share_id=eq.${encodeURIComponent(shareId)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: 'PATCH', body: { subject } },
      );
      if ((!Array.isArray(updated) || updated.length === 0) && user.email && !/[%_*]/.test(user.email)) {
        updated = await sbFetch(
          env,
          `transfers?share_id=eq.${encodeURIComponent(shareId)}&user_id=is.null&sender_email=eq.${encodeURIComponent(user.email)}`,
          { method: 'PATCH', body: { subject } },
        );
      }
      if (!Array.isArray(updated) || updated.length === 0) {
        return json(403, { error: 'You can only rename your own transfers.', code: 'RENAME_FORBIDDEN' });
      }
      return json(200, { ok: true, shareId, subject });
    }

    if (action === 'admin-summary') {
      const user = await authUser(request, env);
      if (user.invalid || !user.id) return json(401, { error: 'Sign in required.', code: 'AUTH_REQUIRED' });
      if (!user.email || !ADMIN_EMAILS.has(user.email)) {
        return json(403, { error: 'This summary is not available.', code: 'ADMIN_FORBIDDEN' });
      }
      const rows = await sbFetch(
        env,
        'transfers?select=sender_email,file_size,created_at&order=created_at.desc&limit=500',
      );
      const uploaders = new Map();
      for (const row of Array.isArray(rows) ? rows : []) {
        const email = String(row.sender_email || 'guest@itransfer.in').toLowerCase();
        if (!uploaders.has(email)) {
          uploaders.set(email, { email, uploadsCount: 0, totalBytes: 0, lastActive: row.created_at || null });
        }
        const entry = uploaders.get(email);
        entry.uploadsCount += 1;
        entry.totalBytes += Number(row.file_size || 0);
      }
      return json(200, { uploaders: [...uploaders.values()] });
    }

    if (action === 'download-url') {
      const started = Date.now();
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const denied = rateLimitDenied(await checkSharedLimit(env, 'download', clientIp), 'Download rate limit reached.');
      if (denied) return denied;
      const shareId = normalizeShareId(url.searchParams.get('shareId'));
      const fileId = url.searchParams.get('fileId') || '';
      if (!shareId || !isFileId(fileId)) {
        return json(400, { error: 'A share id and file id are required.', code: 'DOWNLOAD_INVALID' });
      }
      const rows = await sbFetch(
        env,
        `transfers?id=eq.${encodeURIComponent(fileId)}&share_id=eq.${encodeURIComponent(shareId)}&select=id,share_id,file_name,file_path,expires_at,status,password_hash,max_downloads,download_count&limit=1`,
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row?.file_path || !row.file_path.startsWith('transfers/') || row.file_path.includes('..')) {
        return json(404, { error: 'This transfer was not found.', code: 'NOT_FOUND' });
      }
      const state = transferState(row);
      if (state === 'expired') {
        logDownload('denied', 'EXPIRED', started);
        return json(410, { error: 'This transfer has expired.', code: 'EXPIRED' });
      }
      if (state !== 'active') {
        logDownload('denied', 'NOT_READY', started);
        return json(409, { error: 'This transfer is not ready.', code: 'NOT_READY' });
      }
      if (row.password_hash) {
        const passwordDenied = rateLimitDenied(
          await checkSharedLimit(env, 'password', await passwordLimitKey(shareId, clientIp)),
          'Too many password attempts.',
        );
        if (passwordDenied) return passwordDenied;
        const blocked = rejectIfPasswordFailuresExceeded(shareId);
        if (blocked) return blocked;
        const pw = request.headers.get('x-transfer-password') || '';
        if (!pw || !(await passwordMatches(row.password_hash, pw))) {
          recordPasswordFailure(shareId);
          if (!pw) {
            logDownload('denied', 'PASSWORD_REQUIRED', started);
            return json(401, { error: 'Password required.', code: 'PASSWORD_REQUIRED' });
          }
          logDownload('denied', 'PASSWORD_INCORRECT', started);
          return json(401, { error: 'Incorrect password.', code: 'PASSWORD_INCORRECT' });
        }
      }
      const customFileName = url.searchParams.get('customFileName');
      const query = {};
      if (customFileName) {
        const safe = sanitizeFileName(customFileName);
        query['response-content-disposition'] = `attachment; filename="${safe}"`;
      }
      const claimed = await sbFetch(env, 'rpc/claim_download_slot', {
        method: 'POST',
        body: { p_file_id: row.id, p_share_id: shareId },
      });
      const slot = Array.isArray(claimed) ? claimed[0] : claimed;
      if (!slot?.ok) {
        if (slot?.code === 'DOWNLOAD_LIMIT') {
          logDownload('denied', 'LINK_LIMIT', started);
          return json(410, { error: 'This transfer reached its link limit.', code: 'DOWNLOAD_LIMIT' });
        }
        if (slot?.code === 'EXPIRED') return json(410, { error: 'This transfer has expired.', code: 'EXPIRED' });
        if (slot?.code === 'NOT_READY') return json(409, { error: 'This transfer is not ready.', code: 'NOT_READY' });
        return json(404, { error: 'This transfer was not found.', code: 'NOT_FOUND' });
      }
      let downloadUrl;
      try {
        downloadUrl = await presign({
          ...cfg,
          method: 'GET',
          path: `/${cfg.bucket}/${slot.file_path}`,
          query,
          expires: STORAGE_POLICY.downloadUrlSeconds,
        });
      } catch {
        await sbFetch(env, 'rpc/release_download_slot', {
          method: 'POST',
          body: { p_file_id: row.id, p_share_id: shareId },
        }).catch(() => {});
        logDownload('denied', 'SIGN_FAILED', started);
        return json(502, { error: 'Could not prepare this download.', code: 'SIGN_FAILED' });
      }
      logDownload('url_issued', 'SIGNED_URL', started);
      return json(200, { downloadUrl, downloadCount: slot.download_count });
    }

    if (action === 'initiate-upload' && request.method === 'POST') {
      const started = Date.now();
      if (uploadsPaused(env)) return uploadPauseResponse();
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const denied = rateLimitDenied(await checkSharedLimit(env, 'upload', clientIp), 'Upload rate limit reached.');
      if (denied) return denied;
      const owner = await optionalOwner(request, env);
      if (owner.error) return owner.error;
      const body = await readBody(request);
      const allowance = await transferCapFor(env, owner.id);
      const tooBig = sizeError(body.fileSize, allowance.bytes);
      if (tooBig) return json(403, { error: tooBig, code: 'TRANSFER_TOO_LARGE' });
      const malware = isMaliciousFile(body.fileName);
      if (malware.isDangerous) return json(400, { error: malware.reason, code: 'MALICIOUS_FILE_BLOCKED' });
      const gate = await requireDeleteClaim(env, body.deleteToken);
      if (gate.error) return gate.error;
      const portal = await requireOpenRequest(env, body.requestId);
      if (portal.error) return portal.error;
      const safeName = sanitizeFileName(body.fileName);
      const key = `transfers/${Date.now()}-${randomId(8)}/${safeName}`;
      const passwordHash = await hashPassword(body.password);
      const reserved = await reserveTransferRow(env, reservationArgs({
        claim: gate.claim,
        owner,
        body,
        key,
        safeName,
        passwordHash,
        requestId: portal.requestId,
      }), request);
      if (reserved) return reserved;
      const res = await signedFetch({
        ...cfg,
        method: 'POST',
        path: `/${cfg.bucket}/${key}`,
        query: { uploads: '' },
        contentType: body.contentType || 'application/octet-stream',
      });
      const xml = await res.text();
      const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
      if (!res.ok || !uploadId || !/^[\w.-]+$/.test(uploadId)) {
        await releaseReservation(env, key);
        opsEvent({ event: 'upload', result: 'rejected', category: 'MULTIPART_FAILED', durationMs: Date.now() - started });
        return json(502, { error: 'Could not start multipart upload.', code: 'MULTIPART_FAILED' });
      }
      try {
        await sbFetch(env, `transfers?file_path=eq.${encodeURIComponent(key)}`, {
          method: 'PATCH',
          body: { multipart_upload_id: uploadId },
        });
      } catch (err) {
        await signedFetch({
          ...cfg,
          method: 'DELETE',
          path: `/${cfg.bucket}/${key}`,
          query: { uploadId },
        }).catch(() => {});
        await releaseReservation(env, key);
        throw err;
      }
      opsEvent({ event: 'upload', result: 'url_issued', category: 'MULTIPART', durationMs: Date.now() - started });
      return json(200, { uploadId, s3Key: key, shareId: gate.claim.share_id, safeFileName: safeName, bucket: cfg.bucket });
    }

    if ((action === 'get-part-url' || action === 'get-part-urls' || action === 'list-parts') && request.method === 'POST') {
      if (uploadsPaused(env)) return uploadPauseResponse();
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const body = await readBody(request);
      if (!body.s3Key?.startsWith('transfers/') || body.s3Key.includes('..') || !body.uploadId) {
        return json(400, { error: 'Missing s3Key or uploadId.' });
      }
      const gate = await requireDeleteClaim(env, body.deleteToken);
      if (gate.error) return gate.error;
      const row = await loadTransferByPath(env, body.s3Key);
      if (!row || row.share_id !== gate.claim.share_id || row.multipart_upload_id !== body.uploadId || row.status !== 'pending') {
        return json(403, { error: 'That upload session is not valid.', code: 'UPLOAD_NOT_AUTHORIZED' });
      }
      if (action === 'list-parts') {
        const listed = await listUploadedParts(cfg, body.s3Key, body.uploadId);
        return json(200, { parts: listed });
      }
      if (action === 'get-part-urls' && !Array.isArray(body.partNumbers)) {
        return json(400, { error: 'partNumbers must be an array.', code: 'PART_NUMBERS_INVALID' });
      }
      if (Array.isArray(body.partNumbers) && body.partNumbers.length > 5) {
        return json(400, { error: 'At most 5 part numbers can be signed at once.', code: 'PART_BATCH_TOO_LARGE' });
      }
      const partNumbers = Array.isArray(body.partNumbers)
        ? body.partNumbers.map(Number).filter((n) => n > 0 && n < 10000)
        : body.partNumber
          ? [Number(body.partNumber)]
          : [];
      if (partNumbers.length === 0) return json(400, { error: 'Missing partNumber or partNumbers.' });
      const denied = rateLimitDenied(await checkSharedLimit(env, 'parts', clientIp), 'Upload rate limit reached.');
      if (denied) return denied;
      const parts = [];
      for (const partNumber of partNumbers) {
        const presignedUrl = await presign({
          ...cfg,
          method: 'PUT',
          path: `/${cfg.bucket}/${body.s3Key}`,
          query: { partNumber: String(partNumber), uploadId: body.uploadId },
          expires: STORAGE_POLICY.uploadUrlSeconds,
        });
        parts.push({ partNumber, presignedUrl });
      }
      if (parts.length === 1 && action === 'get-part-url') return json(200, parts[0]);
      return json(200, { parts });
    }

    if (action === 'complete-upload' && request.method === 'POST') {
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const body = await readBody(request);
      if (!body.s3Key?.startsWith('transfers/') || body.s3Key.includes('..') || !body.uploadId || !Array.isArray(body.parts)) {
        return json(400, { error: 'Missing s3Key, uploadId, or parts.' });
      }
      const gate = await requireDeleteClaim(env, body.deleteToken);
      if (gate.error) return gate.error;
      const pending = await loadTransferByPath(env, body.s3Key);
      if (!pending || pending.share_id !== gate.claim.share_id || pending.multipart_upload_id !== body.uploadId || pending.status !== 'pending') {
        return json(403, { error: 'That upload session is not valid.', code: 'UPLOAD_NOT_AUTHORIZED' });
      }
      let listed = [];
      try {
        listed = await listUploadedParts(cfg, body.s3Key, body.uploadId);
      } catch {
        listed = [];
      }
      const merged = mergeCompleteParts(listed, body.parts);
      const partsXml = merged
        .map((part) => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXml(part.etag)}</ETag></Part>`)
        .join('');
      if (!partsXml) return json(400, { error: 'Upload parts were not valid.' });
      const res = await signedFetch({
        ...cfg,
        method: 'POST',
        path: `/${cfg.bucket}/${body.s3Key}`,
        query: { uploadId: body.uploadId },
        body: `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`,
        contentType: 'application/xml',
      });
      if (!res.ok) return json(502, { error: 'Could not complete upload.', code: 'MULTIPART_FAILED' });
      return activateObject(env, cfg, { s3Key: body.s3Key, claim: gate.claim });
    }

    if (action === 'abort-upload' && request.method === 'POST') {
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const body = await readBody(request);
      if (!body.s3Key?.startsWith('transfers/') || body.s3Key.includes('..') || !body.uploadId) {
        return json(400, { error: 'Missing s3Key or uploadId.' });
      }
      const gate = await requireDeleteClaim(env, body.deleteToken);
      if (gate.error) return gate.error;
      const pending = await loadTransferByPath(env, body.s3Key);
      if (!pending || pending.share_id !== gate.claim.share_id || pending.multipart_upload_id !== body.uploadId) {
        return json(403, { error: 'That upload session is not valid.', code: 'UPLOAD_NOT_AUTHORIZED' });
      }
      if (pending.status !== 'pending') {
        return json(409, { error: 'That upload is no longer in progress.', code: 'UPLOAD_NOT_PENDING' });
      }
      const abort = await signedFetch({
        ...cfg,
        method: 'DELETE',
        path: `/${cfg.bucket}/${body.s3Key}`,
        query: { uploadId: body.uploadId },
      });
      if (!abort.ok && abort.status !== 404) {
        return json(502, { error: 'Could not abort the upload.', code: 'ABORT_FAILED' });
      }
      await sbFetch(env, `transfers?file_path=eq.${encodeURIComponent(body.s3Key)}&status=eq.pending`, {
        method: 'PATCH',
        body: { status: 'rejected' },
      });
      const allowance = await transferCapFor(env, pending.user_id);
      if (!allowance.paid) {
        await releaseDailyUpload(env, {
          subject: await dailyUploadSubject(request),
          bytes: Number(pending.file_size) || 0,
        });
      }
      return json(200, { ok: true, status: 'rejected' });
    }

    if (action === 'finalize-upload' && request.method === 'POST') {
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const body = await readBody(request);
      if (!body.s3Key?.startsWith('transfers/') || body.s3Key.includes('..')) {
        return json(400, { error: 'Invalid storage key.' });
      }
      const gate = await requireDeleteClaim(env, body.deleteToken);
      if (gate.error) return gate.error;
      return activateObject(env, cfg, { s3Key: body.s3Key, claim: gate.claim });
    }

    if (action === 'verify-password' && request.method === 'POST') {
      const body = await readBody(request);
      const shareId = normalizeShareId(body.shareId);
      const limitKey = await passwordLimitKey(shareId, clientIp);
      const denied = rateLimitDenied(
        await checkSharedLimit(env, 'password', limitKey),
        'Too many password attempts.',
      );
      if (denied) return denied;
      if (!shareId) {
        return json(400, { error: 'shareId and inputPassword are required.' });
      }
      const blocked = rejectIfPasswordFailuresExceeded(shareId);
      if (blocked) return blocked;
      const rows = await sbFetch(env, `transfers?share_id=eq.${encodeURIComponent(shareId)}&select=password_hash&limit=1`);
      const stored = Array.isArray(rows) ? rows[0]?.password_hash : null;
      const typed = body.inputPassword;
      if (!stored) {
        if (!typed) return json(400, { error: 'shareId and inputPassword are required.' });
        return json(401, { error: 'Incorrect password.', code: 'PASSWORD_INCORRECT' });
      }
      if (!typed || !(await passwordMatches(stored, typed))) {
        recordPasswordFailure(shareId);
        if (!typed) return json(401, { error: 'Password required.', code: 'PASSWORD_REQUIRED' });
        return json(401, { error: 'Incorrect password.', code: 'PASSWORD_INCORRECT' });
      }
      return json(200, { success: true });
    }

    if (action === 'claim' && request.method === 'POST') {
      const denied = rateLimitDenied(await checkSharedLimit(env, 'claim', clientIp), 'Too many claim attempts.');
      if (denied) return denied;
      const user = await authUser(request, env);
      if (!user.id) return json(401, { error: 'Sign in before claiming a transfer.', code: 'AUTH_REQUIRED' });
      if (!/^[0-9a-f-]{36}$/i.test(user.id)) return json(401, { error: 'Sign-in could not be verified.', code: 'AUTH_INVALID' });
      const body = await readBody(request);
      const claim = await findClaim(env, body.token, 'claim');
      const usable = claimUsable(claim);
      if (!usable.ok) return json(usable.status, { error: usable.error, code: usable.code });
      const requested = body.shareId ? normalizeShareId(body.shareId) : claim.share_id;
      if (!requested || requested !== claim.share_id) {
        return json(403, { error: 'That claim token does not match this transfer.', code: 'CLAIM_MISMATCH' });
      }
      const claimId = encodeURIComponent(claim.id);
      const consumed = await sbFetch(env, `transfer_claims?id=eq.${claimId}&used_at=is.null`, {
        method: 'PATCH',
        body: { used_at: new Date().toISOString() },
      });
      if (!Array.isArray(consumed) || consumed.length === 0) {
        return json(409, { error: 'This claim token was already used.', code: 'TOKEN_USED' });
      }
      try {
        const updated = await sbFetch(
          env,
          `transfers?share_id=eq.${encodeURIComponent(claim.share_id)}&or=(user_id.is.null,user_id.eq.${user.id})`,
          { method: 'PATCH', body: { user_id: user.id } },
        );
        if (!Array.isArray(updated) || updated.length === 0) {
          await sbFetch(env, `transfer_claims?id=eq.${claimId}`, { method: 'PATCH', body: { used_at: null } });
          return json(409, { error: 'This transfer could not be claimed.', code: 'CLAIM_REJECTED' });
        }
        return json(200, { ok: true, shareId: claim.share_id, claimedFiles: updated.length });
      } catch (err) {
        await sbFetch(env, `transfer_claims?id=eq.${claimId}`, { method: 'PATCH', body: { used_at: null } }).catch(() => {});
        throw err;
      }
    }

    if (action === 'delete-own' && request.method === 'POST') {
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const denied = rateLimitDenied(await checkSharedLimit(env, 'delete', clientIp), 'Too many delete attempts.');
      if (denied) return denied;
      const body = await readBody(request);
      let shareId = null;
      let claim = null;
      if (body.token) {
        claim = await findClaim(env, body.token, 'delete');
        const usable = claimUsable(claim);
        if (!usable.ok) return json(usable.status, { error: usable.error, code: usable.code });
        shareId = claim.share_id;
        if (body.shareId && normalizeShareId(body.shareId) !== shareId) {
          return json(403, { error: 'That delete token does not match this transfer.', code: 'DELETE_MISMATCH' });
        }
      } else {
        const user = await authUser(request, env);
        if (!user.id) return json(401, { error: 'A delete token or signed-in owner is required.', code: 'DELETE_UNAUTHORIZED' });
        shareId = normalizeShareId(body.shareId);
        if (!shareId) return json(400, { error: 'shareId is required.' });
      }
      const rows = await sbFetch(
        env,
        `transfers?share_id=eq.${encodeURIComponent(shareId)}&select=file_path,status,user_id,multipart_upload_id,share_id`,
      );
      const files = Array.isArray(rows) ? rows : [];
      if (files.length === 0) return json(404, { error: 'This transfer was not found.', code: 'NOT_FOUND' });
      if (!claim) {
        const user = await authUser(request, env);
        if (!files.every((row) => row.user_id && row.user_id === user.id)) {
          return json(403, { error: 'You can only delete your own transfers.', code: 'DELETE_FORBIDDEN' });
        }
      }
      for (const row of files) {
        if (!row.file_path?.startsWith('transfers/') || row.file_path.includes('..')) {
          return json(400, { error: 'Invalid storage key.' });
        }
        if (row.multipart_upload_id && row.status === 'pending') {
          const abort = await signedFetch({
            ...cfg,
            method: 'DELETE',
            path: `/${cfg.bucket}/${row.file_path}`,
            query: { uploadId: row.multipart_upload_id },
          });
          if (!abort.ok && abort.status !== 404) {
            return json(502, { error: 'The unfinished upload could not be aborted.', code: 'DELETE_FAILED' });
          }
        }
        const deleted = await signedFetch({ ...cfg, method: 'DELETE', path: `/${cfg.bucket}/${row.file_path}` });
        if (!deleted.ok && deleted.status !== 404) {
          return json(502, { error: 'The file could not be deleted. It is still available.', code: 'DELETE_FAILED' });
        }
      }
      await sbFetch(env, `transfers?share_id=eq.${encodeURIComponent(shareId)}`, {
        method: 'PATCH',
        body: { status: 'expired' },
      });
      if (claim) {
        await sbFetch(env, `transfer_claims?id=eq.${encodeURIComponent(claim.id)}&used_at=is.null`, {
          method: 'PATCH',
          body: { used_at: new Date().toISOString() },
        });
      }
      return json(200, { ok: true, shareId });
    }

    if (action === 'delete-object' && request.method === 'POST') {
      const denied = requireCleanupSecret(request, env);
      if (denied) return denied;
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const body = await readBody(request);
      const s3Key = String(body.s3Key || body.filePath || '').trim();
      if (!s3Key || s3Key.includes('..') || (!s3Key.startsWith('transfers/') && !s3Key.startsWith('requests/'))) {
        return json(400, { error: 'Invalid object key.' });
      }
      const delRes = await signedFetch({ ...cfg, method: 'DELETE', path: `/${cfg.bucket}/${s3Key}` });
      if (!delRes.ok && delRes.status !== 404) {
        return json(502, { error: 'Could not delete object.', code: 'DELETE_FAILED' });
      }
      return json(200, { ok: true, s3Key });
    }

    if (action === 'cleanup') {
      const denied = requireCleanupSecret(request, env);
      if (denied) return denied;
      const missing = requireConfig(cfg);
      if (missing) return missing;
      if (!envGet(env, 'SUPABASE_SERVICE_ROLE_KEY')) {
        return json(503, { error: 'Storage records are not configured.', code: 'NO_SERVICE_ROLE' });
      }
      const now = Date.now();
      const cleanupBatch = 200;
      const orphanMaxHours = 24 * 90;
      const maxListPages = 5;
      let purgedCount = 0;
      let releasedCount = 0;
      let pendingCount = 0;
      let checked = 0;

      async function removeCleanupObject(row) {
        const key = safeCleanupKey(row.file_path);
        if (!key) return false;
        if (row.multipart_upload_id && (row.status === 'pending' || row.status === 'pending_delete')) {
          const abort = await signedFetch({
            ...cfg,
            method: 'DELETE',
            path: `/${cfg.bucket}/${key}`,
            query: { uploadId: row.multipart_upload_id },
          });
          if (!abort.ok && abort.status !== 404) return false;
        }
        const del = await signedFetch({ ...cfg, method: 'DELETE', path: `/${cfg.bucket}/${key}` });
        return del.ok || del.status === 404;
      }

      const rows = await sbFetch(
        env,
        `transfers?select=id,share_id,file_path,expires_at,status,multipart_upload_id&expires_at=lt.${encodeURIComponent(new Date(now).toISOString())}&or=(status.eq.active,status.eq.pending_delete,status.eq.pending)&order=status.asc,expires_at.asc,id.asc&limit=${cleanupBatch}`,
      );
      if (!Array.isArray(rows)) {
        opsEvent({ event: 'cleanup', result: 'failed', category: 'CLEANUP_RECORD_FAILED', durationMs: Date.now() - now });
        return json(503, { error: 'Cleanup could not read expired transfers.', code: 'CLEANUP_RECORD_FAILED' });
      }

      for (const row of rows) {
        checked += 1;
        const removed = await removeCleanupObject(row);
        if (removed) {
          await markCleanupStatus(env, row.id, 'expired');
          purgedCount += 1;
        } else {
          await markCleanupStatus(env, row.id, 'pending_delete');
          pendingCount += 1;
        }
      }

      const abandonBefore = new Date(now - (STORAGE_POLICY.uploadUrlSeconds + SINGLE_PUT_ABANDON_GRACE_SECONDS) * 1000).toISOString();
      const stale = await sbFetch(
        env,
        `transfers?select=id,share_id,file_path,expires_at,status,multipart_upload_id,created_at&status=eq.pending&multipart_upload_id=is.null&created_at=lt.${encodeURIComponent(abandonBefore)}&order=created_at.asc,id.asc&limit=${cleanupBatch}`,
      );
      if (!Array.isArray(stale)) {
        opsEvent({ event: 'cleanup', result: 'failed', category: 'CLEANUP_RECORD_FAILED', durationMs: Date.now() - now });
        return json(503, { error: 'Cleanup could not read abandoned reservations.', code: 'CLEANUP_RECORD_FAILED' });
      }

      for (const row of stale) {
        checked += 1;
        if (row.multipart_upload_id) continue;
        const expired = row.expires_at && new Date(row.expires_at).getTime() <= now;
        const removed = await removeCleanupObject(row);
        if (!removed) {
          if (expired) await markCleanupStatus(env, row.id, 'pending_delete');
          pendingCount += 1;
          continue;
        }
        await markCleanupStatus(env, row.id, expired ? 'expired' : 'released');
        if (expired) purgedCount += 1;
        else releasedCount += 1;
      }

      const multipartAbandonBefore = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const staleMultipart = await sbFetch(
        env,
        `transfers?select=id,share_id,file_path,expires_at,status,multipart_upload_id,created_at&status=eq.pending&multipart_upload_id=not.is.null&created_at=lt.${encodeURIComponent(multipartAbandonBefore)}&order=created_at.asc,id.asc&limit=${cleanupBatch}`,
      );
      if (!Array.isArray(staleMultipart)) {
        opsEvent({ event: 'cleanup', result: 'failed', category: 'CLEANUP_RECORD_FAILED', durationMs: Date.now() - now });
        return json(503, { error: 'Cleanup could not read abandoned multipart uploads.', code: 'CLEANUP_RECORD_FAILED' });
      }
      for (const row of staleMultipart) {
        checked += 1;
        if (!row.multipart_upload_id || !multipartIsAbandoned(row.created_at, now)) continue;
        const expired = row.expires_at && new Date(row.expires_at).getTime() <= now;
        const removed = await removeCleanupObject(row);
        if (!removed) {
          if (expired) await markCleanupStatus(env, row.id, 'pending_delete');
          pendingCount += 1;
          continue;
        }
        await markCleanupStatus(env, row.id, expired ? 'expired' : 'released');
        if (expired) purgedCount += 1;
        else releasedCount += 1;
      }

      const uploadsRes = await signedFetch({
        ...cfg,
        method: 'GET',
        path: `/${cfg.bucket}`,
        query: { uploads: '', prefix: 'transfers/', 'max-uploads': '50' },
      });
      if (uploadsRes.ok) {
        const uploadsXml = await uploadsRes.text();
        for (const upload of parseIncompleteUploads(uploadsXml)) {
          const initiated = new Date(upload.initiated).getTime();
          if (!Number.isFinite(initiated) || now - initiated < 24 * 60 * 60 * 1000) continue;
          checked += 1;
          const abort = await signedFetch({
            ...cfg,
            method: 'DELETE',
            path: `/${cfg.bucket}/${upload.key}`,
            query: { uploadId: upload.uploadId },
          });
          if (abort.ok || abort.status === 404) releasedCount += 1;
          else pendingCount += 1;
        }
      }

      let token = '';
      const seenTokens = new Set();
      for (let page = 0; page < maxListPages; page += 1) {
        if (token) {
          if (seenTokens.has(token)) break;
          seenTokens.add(token);
        }
        const res = await signedFetch({
          ...cfg,
          method: 'GET',
          path: `/${cfg.bucket}`,
          query: {
            'list-type': '2',
            prefix: 'transfers/',
            'max-keys': '200',
            ...(token ? { 'continuation-token': token } : {}),
          },
        });
        const xml = await res.text();
        if (!res.ok) {
          opsEvent({
            event: 'cleanup',
            result: 'failed',
            category: 'LIST_FAILED',
            count: pendingCount,
            durationMs: Date.now() - now,
          });
          // Database expiry already ran. A flaky bucket list must not fail the hourly job.
          break;
        }
        const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => match[1]);
        for (const key of keys) {
          checked += 1;
          const stamp = Number(String(key).match(/transfers\/(\d+)-/)?.[1] || 0);
          if (!stamp) continue;
          const ageHours = (now - stamp) / 36e5;
          if (ageHours <= orphanMaxHours) continue;
          let existing = null;
          try {
            existing = await loadTransferByPath(env, key);
          } catch {
            continue;
          }
          if (existing && existing.status !== 'expired' && existing.status !== 'rejected' && existing.status !== 'released') continue;
          if (existing && existing.expires_at && new Date(existing.expires_at).getTime() > now) continue;
          const deleted = await signedFetch({ ...cfg, method: 'DELETE', path: `/${cfg.bucket}/${key}` });
          if (deleted.ok || deleted.status === 404) purgedCount += 1;
        }
        const next = nextListToken(xml);
        if (!next) break;
        token = next;
      }

      opsEvent({
        event: 'cleanup',
        result: pendingCount > 0 ? 'failed' : 'completed',
        category: pendingCount > 0 ? 'OBJECT_DELETE_FAILED' : 'PURGED',
        count: pendingCount > 0 ? pendingCount : purgedCount,
        durationMs: Date.now() - now,
      });
      return json(200, { message: 'Expired R2 objects purged', purgedCount, releasedCount, pendingCount, checked });
    }

    if (action === 'ensure-cors' && request.method === 'POST') {
      const denied = requireCleanupSecret(request, env);
      if (denied) return denied;
      const missing = requireConfig(cfg);
      if (missing) return missing;
      const corsXml = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;
      const res = await signedFetch({
        ...cfg,
        method: 'PUT',
        path: `/${cfg.bucket}`,
        query: { cors: '' },
        body: corsXml,
        contentType: 'application/xml',
      });
      if (!res.ok) {
        const detail = await res.text();
        return json(502, { error: 'Could not set R2 CORS.', detail: detail.slice(0, 300) });
      }
      return json(200, { ok: true, bucket: cfg.bucket });
    }

    return json(400, { error: `Unsupported action "${action}"` });
  } catch (err) {
    const code = typeof err?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(err.code) ? err.code : 'UNHANDLED';
    opsEvent({ event: 'request', result: 'failed', category: code });
    if (err?.code === 'LOCAL_SUPABASE_REQUIRED') return json(503, { error: err.message, code: err.code });
    if (err?.code === 'PASSWORD') return json(400, { error: err.message, code: 'PASSWORD' });
    if (err?.code === 'NO_SERVICE_ROLE' || err?.status) return dbErrorResponse(err);
    return json(500, { error: 'R2 operation failed.' });
  }
}
