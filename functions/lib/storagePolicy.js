/** Decimal gigabyte. Application limits, not a Cloudflare billing cap. */
export const GB = 1_000_000_000;

/** Whole-platform hard cap. Override with STORAGE_GLOBAL_CAP_BYTES after the 2 TB migration. */
export const DEFAULT_STORAGE_CAP_BYTES = 2_000_000_000_000;
export const STORAGE_SOFT_RATIO = 0.9;
/** Free sends from one network, per rolling day. Paid accounts are not counted. */
export const DEFAULT_GUEST_DAILY_BYTES = 30 * GB;

export function storageCapBytes(env) {
  const raw = Number(env?.STORAGE_GLOBAL_CAP_BYTES);
  if (Number.isFinite(raw) && raw >= 6 * GB) return Math.floor(raw);
  return DEFAULT_STORAGE_CAP_BYTES;
}

export function guestDailyBytes(env) {
  const raw = Number(env?.GUEST_DAILY_UPLOAD_BYTES);
  if (Number.isFinite(raw) && raw >= GB) return Math.floor(raw);
  return DEFAULT_GUEST_DAILY_BYTES;
}

/**
 * Hard cap blocks everyone. Past the soft ratio, free and guest sends wait
 * so a paying account can still upload until the hard cap.
 */
export function storageAdmission({
  occupied = 0,
  incoming = 0,
  cap = DEFAULT_STORAGE_CAP_BYTES,
  paid = false,
  softRatio = STORAGE_SOFT_RATIO,
} = {}) {
  const next = Number(occupied) + Number(incoming);
  const limit = Number(cap);
  if (!Number.isFinite(next) || next < 0 || !Number.isFinite(limit) || limit <= 0) {
    return { ok: false, code: 'STORAGE_CAP' };
  }
  if (next > limit) return { ok: false, code: 'STORAGE_CAP' };
  const soft = Math.floor(limit * Number(softRatio));
  if (!paid && next > soft) return { ok: false, code: 'STORAGE_BUSY' };
  return { ok: true, remaining: limit - next };
}

export const STORAGE_POLICY = {
  // Unused account-ledger helper. Do not treat quotaBytes as the platform cap.
  // platformQuotaBytes is the whole-platform cap, not a quota each paid user receives.
  // It is enforced inside public.reserve_transfer_file.
  quotaBytes: 7 * GB,
  platformQuotaBytes: DEFAULT_STORAGE_CAP_BYTES,
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
