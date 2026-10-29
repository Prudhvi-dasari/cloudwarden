/** Decimal gigabyte. Application limits, not a Cloudflare billing cap. */
export const GB = 1_000_000_000;

export const STORAGE_POLICY = {
  // Unused account-ledger helper. Do not treat quotaBytes as the platform cap.
  // platformQuotaBytes is the whole-platform cap, not a quota each paid user receives.
  // It is enforced inside public.reserve_transfer_file.
  quotaBytes: 7 * GB,
  platformQuotaBytes: 1000 * GB,
  guestMaxBytes: 6 * GB,
  freeTransferBytes: 6 * GB,
  freeRetentionHours: 168,
  paidTransferBytes: 250 * GB,
  paidRetentionHours: 180 * 24,
  paidFeaturesEnabled: true,
  guestMaxHours: 168,
  uploadUrlSeconds: 15 * 60,
  downloadUrlSeconds: 15 * 60,
};

export function allowanceForStatus(status) {
  if (status === 'active') {
    return {
      bytes: STORAGE_POLICY.paidTransferBytes,
      hours: STORAGE_POLICY.paidRetentionHours,
      paid: true,
    };
  }
  return {
    bytes: STORAGE_POLICY.freeTransferBytes,
    hours: STORAGE_POLICY.freeRetentionHours,
    paid: false,
  };
}

export function canReserve(state, bytes) {
  const committed = Number(state.committedBytes ?? state.committed_bytes ?? 0);
  const reserved = Number(state.reservedBytes ?? state.reserved_bytes ?? 0);
  const quota = Number(state.quotaBytes ?? state.quota_bytes ?? STORAGE_POLICY.quotaBytes);
  return committed + reserved + Number(bytes) <= quota;
}
