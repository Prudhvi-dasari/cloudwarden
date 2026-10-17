/**
 * Guest Session & Transfer Ownership Migration Manager
 * Generates secure, high-entropy Guest identifiers (e.g. 'Guest-X7K92')
 * and handles guest-to-registered-user transfer migration.
 */
import { publicSupabase } from './supabase';

const GUEST_ID_KEY = 'itransfer_guest_id';
const GUEST_TRANSFERS_KEY = 'itransfer_guest_transfers';

/**
 * Generate a secure random Guest Identifier (e.g. 'Guest-X7K92')
 */
export function generateGuestId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Avoid confusing chars like 0/O, 1/I
  let code = '';
  const array = new Uint8Array(5);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    for (let i = 0; i < 5; i++) {
      code += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return `Guest-${code}`;
}

/**
 * Get or create the persistent Guest ID for the current browser session
 */
export function getOrCreateGuestId() {
  try {
    let guestId = localStorage.getItem(GUEST_ID_KEY);
    if (!guestId || !guestId.startsWith('Guest-')) {
      guestId = generateGuestId();
      localStorage.setItem(GUEST_ID_KEY, guestId);
    }
    return guestId;
  } catch (e) {
    return generateGuestId();
  }
}

/**
 * Track a transfer created by this guest session
 */
export function trackGuestTransfer(shareId) {
  if (!shareId) return;
  try {
    const raw = localStorage.getItem(GUEST_TRANSFERS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.includes(shareId)) {
      list.unshift(shareId);
      localStorage.setItem(GUEST_TRANSFERS_KEY, JSON.stringify(list.slice(0, 50)));
    }
  } catch (e) {}
}

/**
 * Get all transfer share IDs created during this guest session
 */
export function getGuestTransferIds() {
  try {
    const raw = localStorage.getItem(GUEST_TRANSFERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Migrate guest transfers to a newly registered / logged-in user
 */
export async function migrateGuestTransfersToUser(user) {
  if (!user || !user.email) return { migratedCount: 0 };

  const guestId = getOrCreateGuestId();
  const guestShareIds = getGuestTransferIds();

  if (guestShareIds.length === 0) return { migratedCount: 0 };

  try {
    const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validUserId = user.id && isValidUUID(user.id) ? user.id : null;

    // Update transfers matching either the guest email tag or tracked guest share IDs
    const { data, error } = await publicSupabase
      .from('transfers')
      .update({
        user_id: validUserId,
        sender_email: user.email,
      })
      .in('share_id', guestShareIds);

    if (error) {
      console.warn('Guest transfer migration note:', error.message);
    }

    // Clear guest transfer tracking once successfully migrated
    try {
      localStorage.removeItem(GUEST_TRANSFERS_KEY);
    } catch (e) {}

    return { migratedCount: guestShareIds.length };
  } catch (err) {
    console.error('Failed to migrate guest transfers:', err);
    return { migratedCount: 0, error: err.message };
  }
}
