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

export function partCountFor(totalSize, partSize = PART_SIZE_BYTES) {
  const size = Number(totalSize);
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.ceil(size / partSize) || 1;
}

export function partByteLength(partNumber, totalSize, partSize = PART_SIZE_BYTES) {
  const index = Number(partNumber) - 1;
  if (index < 0) return 0;
  const start = index * partSize;
  const end = Math.min(start + partSize, Number(totalSize) || 0);
  return Math.max(0, end - start);
}

/** Parts that still need a PUT. Completed numbers are 1-based. */
export function partsStillNeeded(partCount, completedPartNumbers) {
  const done = new Set(completedPartNumbers || []);
  const needed = [];
  for (let n = 1; n <= partCount; n += 1) {
    if (!done.has(n)) needed.push(n);
  }
  return needed;
}

export function bytesFromCompletedParts(totalSize, completedPartNumbers, partSize = PART_SIZE_BYTES) {
  return (completedPartNumbers || []).reduce(
    (sum, partNumber) => sum + partByteLength(partNumber, totalSize, partSize),
    0,
  );
}

export function isResumeNetworkError(error) {
  const message = String(error?.message || error || '');
  return message === 'Network error during upload'
    || message === 'Upload timed out'
    || message === 'Failed to fetch'
    || /network|offline|failed to fetch/i.test(message);
}
