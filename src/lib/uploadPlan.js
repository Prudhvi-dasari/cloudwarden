/** Single presigned PUT stays small. R2 rejects one PUT above 5 GiB, and the free limit is 6 GB decimal. */
export const SINGLE_PUT_MAX_BYTES = 8 * 1024 * 1024;

export const PART_SIZE_BYTES = 16 * 1024 * 1024;

export function uploadNeedsMultipart(fileSize) {
  const size = Number(fileSize);
  return Number.isFinite(size) && size > SINGLE_PUT_MAX_BYTES;
}
