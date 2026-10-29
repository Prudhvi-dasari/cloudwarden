/** Multipart helpers shared by the R2 worker and unit tests. */

export const MULTIPART_ABANDON_MS = 24 * 60 * 60 * 1000;

export function normalizeEtag(value) {
  const raw = String(value || '').trim().replace(/&quot;/g, '"');
  if (!raw) return '';
  if (!/^"?[A-Za-z0-9._:-]+"?$/.test(raw)) return '';
  return raw.includes('"') ? raw : `"${raw}"`;
}

export function parseListedParts(xml) {
  const parts = [];
  const blocks = String(xml || '').match(/<Part>[\s\S]*?<\/Part>/g) || [];
  for (const block of blocks) {
    const partNumber = Number(block.match(/<PartNumber>\s*(\d+)\s*<\/PartNumber>/)?.[1]);
    const etag = normalizeEtag(block.match(/<ETag>\s*([^<]+)\s*<\/ETag>/)?.[1] || '');
    if (partNumber > 0 && etag) parts.push({ partNumber, etag });
  }
  return parts.sort((a, b) => a.partNumber - b.partNumber);
}

export function parseIncompleteUploads(xml) {
  const uploads = [];
  const blocks = String(xml || '').match(/<Upload>[\s\S]*?<\/Upload>/g) || [];
  for (const block of blocks) {
    const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] || '';
    const uploadId = block.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1] || '';
    const initiated = block.match(/<Initiated>([^<]+)<\/Initiated>/)?.[1] || '';
    if (key.startsWith('transfers/') && uploadId && !key.includes('..')) {
      uploads.push({ key, uploadId, initiated });
    }
  }
  return uploads;
}

/** Listed R2 parts win. Client etags fill any part the list has not returned yet. */
export function mergeCompleteParts(listed, client) {
  const byNumber = new Map();
  for (const part of Array.isArray(client) ? client : []) {
    const partNumber = Number(part?.PartNumber ?? part?.partNumber);
    const etag = normalizeEtag(part?.ETag ?? part?.etag);
    if (partNumber > 0 && etag) byNumber.set(partNumber, etag);
  }
  for (const part of Array.isArray(listed) ? listed : []) {
    if (part?.partNumber > 0 && part.etag) byNumber.set(part.partNumber, part.etag);
  }
  return [...byNumber.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([partNumber, etag]) => ({ partNumber, etag }));
}

export function multipartIsAbandoned(createdAt, now = Date.now()) {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && now - created >= MULTIPART_ABANDON_MS;
}

export function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
