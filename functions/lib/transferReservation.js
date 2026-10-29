/** Share-size rules shared by the reservation RPC stand-in and cleanup tests.
 * Production reservations go through public.reserve_transfer_file, which locks
 * the share for the transaction. This module does not replace that lock.
 */

export const FREE_TRANSFER_BYTES = 6_000_000_000;
export const PLATFORM_QUOTA_BYTES = 2_000_000_000_000;

/** These rows keep their storage reference and do not consume the 6 GB cap. */
export const UNOCCUPIED_STATUSES = new Set(['rejected', 'expired', 'released']);

/** Extra wait after the presigned PUT expires, so clock skew cannot release a live upload. */
export const SINGLE_PUT_ABANDON_GRACE_SECONDS = 60;

const tails = new WeakMap();

export function occupiedTransferBytes(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const status = row?.status || 'active';
    if (UNOCCUPIED_STATUSES.has(status)) return sum;
    return sum + (Number(row.file_size) || 0);
  }, 0);
}

export function reserveInto(rows, body, id) {
  const size = Number(body?.p_file_size);
  if (!Number.isFinite(size) || size <= 0 || size > FREE_TRANSFER_BYTES) {
    return { ok: false, code: 'TRANSFER_TOO_LARGE' };
  }
  const shareId = body?.p_share_id;
  const occupied = occupiedTransferBytes(rows.filter((row) => row.share_id === shareId));
  if (occupied + size > FREE_TRANSFER_BYTES) {
    return { ok: false, code: 'TRANSFER_TOO_LARGE' };
  }
  const platform = occupiedTransferBytes(rows);
  if (platform + size > PLATFORM_QUOTA_BYTES) {
    return { ok: false, code: 'STORAGE_CAP' };
  }
  const row = {
    id,
    share_id: shareId,
    file_name: body.p_file_name,
    file_size: size,
    file_path: body.p_file_path,
    content_type: body.p_content_type,
    subject: body.p_subject ?? null,
    message: body.p_message ?? null,
    sender_email: body.p_sender_email ?? null,
    recipient_emails: body.p_recipient_emails ?? null,
    request_id: body.p_request_id ?? null,
    password_hash: body.p_password_hash ?? null,
    user_id: body.p_user_id ?? null,
    transfer_type: body.p_transfer_type || 'link',
    max_downloads: Number(body.p_max_downloads) > 0 ? Number(body.p_max_downloads) : 0,
    expires_at: body.p_expires_at,
    storage_provider: body.p_storage_provider || 'r2',
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  rows.push(row);
  return { ok: true, id, file_path: row.file_path, status: 'pending' };
}

export function claimDownloadSlot(rows, body) {
  const row = (Array.isArray(rows) ? rows : []).find((item) => item.id === body?.p_file_id && item.share_id === body?.p_share_id);
  if (!row?.file_path || !String(row.file_path).startsWith('transfers/') || String(row.file_path).includes('..')) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  const status = row.status || 'active';
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || status === 'expired' || status === 'pending_delete') {
    return { ok: false, code: 'EXPIRED' };
  }
  if (status !== 'active') return { ok: false, code: 'NOT_READY' };
  const max = Number(row.max_downloads || 0);
  const count = Number(row.download_count || 0);
  if (max > 0 && count >= max) return { ok: false, code: 'DOWNLOAD_LIMIT' };
  row.download_count = count + 1;
  return {
    ok: true,
    download_count: row.download_count,
    file_path: row.file_path,
    file_name: row.file_name,
  };
}

export function releaseDownloadSlot(rows, body) {
  const row = (Array.isArray(rows) ? rows : []).find((item) => item.id === body?.p_file_id && item.share_id === body?.p_share_id);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  const count = Number(row.download_count || 0);
  row.download_count = count > 0 ? count - 1 : 0;
  return { ok: true, download_count: row.download_count };
}

/** Serializes reservations for one share inside one mocked database. */
export function withShareLock(state, shareId, fn) {
  let locks = tails.get(state);
  if (!locks) {
    locks = new Map();
    tails.set(state, locks);
  }
  const key = String(shareId || '');
  const previous = locks.get(key) || Promise.resolve();
  const run = previous.then(fn, fn);
  locks.set(key, run.then(() => undefined, () => undefined));
  return run;
}
