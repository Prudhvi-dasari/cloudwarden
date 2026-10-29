import { STORAGE_POLICY } from './storagePolicy.js';

const encoder = new TextEncoder();

export function retentionHours(expiryHours, maxHours = STORAGE_POLICY.freeRetentionHours) {
  const hours = Number(expiryHours);
  const max = Number(maxHours) > 0 ? Number(maxHours) : STORAGE_POLICY.freeRetentionHours;
  if (!Number.isFinite(hours) || hours <= 0 || hours > max) return max;
  return hours;
}

export function expiresAtFromHours(expiryHours, now = Date.now(), maxHours = STORAGE_POLICY.freeRetentionHours) {
  return new Date(now + retentionHours(expiryHours, maxHours) * 60 * 60 * 1000).toISOString();
}

export function sizeError(fileSize, maxBytes = STORAGE_POLICY.freeTransferBytes) {
  const size = Number(fileSize);
  const max = Number(maxBytes) > 0 ? Number(maxBytes) : STORAGE_POLICY.freeTransferBytes;
  if (!Number.isFinite(size) || size <= 0) return 'A file size is required.';
  if (size > max) {
    return max > STORAGE_POLICY.freeTransferBytes
      ? 'This transfer is larger than the 250 GB limit.'
      : 'This transfer is larger than the 6 GB free limit.';
  }
  return null;
}

export function normalizeShareId(value) {
  const shareId = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{4,80}$/.test(shareId)) return null;
  return shareId;
}

export function generateSecretToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function timingSafeEqual(left, right) {
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] || 0) ^ (b[i] || 0);
  }
  return diff === 0;
}

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  const value = String(password || '');
  if (!value) return null;
  if (value.length > 200) {
    const error = new Error('Password is too long.');
    error.code = 'PASSWORD';
    throw error;
  }
  return sha256Hex(value);
}

export function isSha256Hex(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || '').trim());
}

/**
 * A stored SHA-256 hex matches only the hash of the typed password.
 * Older rows that stored the password itself still match that password.
 * The stored hash is never accepted as the password.
 */
export async function passwordMatches(storedHash, inputPassword) {
  if (!storedHash || inputPassword == null || inputPassword === '') return false;
  const stored = String(storedHash).trim();
  const typed = String(inputPassword);
  const digest = await sha256Hex(typed);
  if (isSha256Hex(stored)) return timingSafeEqual(digest, stored.toLowerCase());
  return timingSafeEqual(typed, stored);
}
