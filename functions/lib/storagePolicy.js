/** Decimal gigabyte. Application limits, not a Cloudflare billing cap. */
export const GB = 1_000_000_000;

export const STORAGE_POLICY = {
  // Ledger quota is not enforced. Global 300 GB caps are a later phase.
  quotaBytes: 7 * GB,
  guestMaxBytes: 6 * GB,
  freeTransferBytes: 6 * GB,
  freeRetentionHours: 168,
  paidFeaturesEnabled: false,
  guestMaxHours: 168,
  uploadUrlSeconds: 15 * 60,
  downloadUrlSeconds: 15 * 60,
};

export function canReserve(state, bytes) {
  const committed = Number(state.committedBytes ?? state.committed_bytes ?? 0);
  const reserved = Number(state.reservedBytes ?? state.reserved_bytes ?? 0);
  const quota = Number(state.quotaBytes ?? state.quota_bytes ?? STORAGE_POLICY.quotaBytes);
  return committed + reserved + Number(bytes) <= quota;
}
