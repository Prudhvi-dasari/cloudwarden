/** Single presigned PUT stays small. R2 rejects one PUT above 5 GiB, and the free limit is 6 GB decimal. */
export const SINGLE_PUT_MAX_BYTES = 8 * 1024 * 1024;

export const PART_SIZE_BYTES = 16 * 1024 * 1024;

/** Presigned part URLs last 15 minutes. Refresh before they expire on a long transfer. */
export const PART_URL_MAX_AGE_MS = 8 * 60 * 1000;

export const PART_UPLOAD_ATTEMPTS = 6;

export function uploadNeedsMultipart(fileSize) {
  const size = Number(fileSize);
  return Number.isFinite(size) && size > SINGLE_PUT_MAX_BYTES;
}

export function normalizePartEtag(value) {
  let etag = String(value || '').trim().replaceAll('&quot;', '"');
  if (!etag) return '';
  if (!etag.startsWith('"')) etag = `"${etag.replaceAll('"', '')}"`;
  return etag;
}

export function partUrlIsStale(issuedAt, now = Date.now()) {
  const issued = Number(issuedAt);
  if (!Number.isFinite(issued) || issued <= 0) return true;
  return now - issued >= PART_URL_MAX_AGE_MS;
}
