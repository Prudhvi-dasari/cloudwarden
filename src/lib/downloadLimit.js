/** Per-file download allowance. Matches download-url: 0 is unlimited. */

export function fileDownloadAllowance(file) {
  const max = Number(file?.maxDownloads);
  const count = Number(file?.downloadCount);
  if (!Number.isFinite(max) || max <= 0) {
    return { limited: false, exhausted: false, remaining: null };
  }
  const used = Number.isFinite(count) && count > 0 ? count : 0;
  const remaining = Math.max(0, max - used);
  return { limited: true, exhausted: remaining === 0, remaining };
}

export function everyFileExhausted(files) {
  return Array.isArray(files) && files.length > 0 && files.every((file) => fileDownloadAllowance(file).exhausted);
}

/** Owner-facing line for one file. The stored count is signed links issued, not each storage fetch. Unlimited files with no links stay unlabeled. */
export function fileDownloadSummary(file) {
  const allowance = fileDownloadAllowance(file);
  const count = Number(file?.downloadCount);
  const used = Number.isFinite(count) && count > 0 ? count : 0;
  if (!allowance.limited) {
    if (!Number.isFinite(count) || used === 0) return null;
    return used === 1 ? '1 link issued' : `${used} links issued`;
  }
  const max = Number(file.maxDownloads);
  if (allowance.exhausted) return `${used} of ${max} links · limit reached`;
  return `${used} of ${max} links`;
}

export function transferFilesExhausted(transfer) {
  return everyFileExhausted(transfer?.files);
}
