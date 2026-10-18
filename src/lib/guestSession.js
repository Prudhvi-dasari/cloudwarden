/**
 * Guest Session & Transfer Ownership Migration Manager
 * Generates secure, high-entropy Guest identifiers (e.g. 'Guest-X7K92')
 * and handles guest-to-registered-user transfer migration.
 */

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

const SECRET_KEY = 'itransfer_transfer_secrets';

function readSecrets() {
  try {
    const raw = localStorage.getItem(SECRET_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSecrets(secrets) {
  try {
    localStorage.setItem(SECRET_KEY, JSON.stringify(secrets));
  } catch {
    /* private mode */
  }
}

/** Keep the claim token and delete token for the browser that created the transfer. */
export function saveTransferSecrets(shareId, { claimToken, deleteToken } = {}) {
  if (!shareId || (!claimToken && !deleteToken)) return;
  const secrets = readSecrets();
  const current = secrets[shareId] || {};
  secrets[shareId] = {
    claimToken: claimToken || current.claimToken || null,
    deleteToken: deleteToken || current.deleteToken || null,
  };
  writeSecrets(secrets);
}

export function getTransferSecrets(shareId) {
  return readSecrets()[shareId] || null;
}

/**
 * Claim guest transfers with one-time tokens. A share id or email is not accepted.
 */
export async function claimGuestTransfers(accessToken) {
  if (!accessToken) return { claimed: 0 };
  const secrets = readSecrets();
  let claimed = 0;
  for (const [shareId, value] of Object.entries(secrets)) {
    if (!value?.claimToken) continue;
    const res = await fetch('/api/r2?action=claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token: value.claimToken }),
    });
    if (!res.ok) continue;
    secrets[shareId] = { ...value, claimToken: null };
    claimed += 1;
  }
  writeSecrets(secrets);
  return { claimed };
}

export async function deleteOwnedTransfer({ shareId, accessToken } = {}) {
  const secrets = shareId ? getTransferSecrets(shareId) : null;
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch('/api/r2?action=delete-own', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      shareId,
      token: secrets?.deleteToken || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'This transfer could not be deleted.');
  if (shareId && secrets) {
    const all = readSecrets();
    if (all[shareId]) {
      all[shareId] = { ...all[shareId], deleteToken: null };
      writeSecrets(all);
    }
  }
  return data;
}

/**
 * Older callers passed a share-id list. Ownership now requires the claim token.
 */
export async function loadOwnedTransfers(accessToken) {
  if (!accessToken) return [];
  const res = await fetch('/api/r2?action=my-transfers', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load transfers.');
  return Array.isArray(data.transfers) ? data.transfers : [];
}

export async function renameOwnedTransfer({ shareId, subject, accessToken }) {
  const res = await fetch('/api/r2?action=rename-transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ shareId, subject }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'This transfer could not be renamed.');
  return data;
}

async function accountRequest(action, { accessToken, method = 'GET', body } = {}) {
  const res = await fetch(`/api/r2?action=${action}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'That request could not be completed.');
  return data;
}

export function createFileRequest({ accessToken, title, instructions }) {
  return accountRequest('create-request', {
    accessToken,
    method: 'POST',
    body: { title, instructions },
  });
}

export function loadFileRequests(accessToken) {
  return accountRequest('my-requests', { accessToken });
}

export function closeFileRequest({ accessToken, requestId }) {
  return accountRequest('close-request', {
    accessToken,
    method: 'POST',
    body: { requestId },
  });
}

export async function migrateGuestTransfersToUser(user, accessToken) {
  if (!user || !accessToken) return { migratedCount: 0 };
  const result = await claimGuestTransfers(accessToken);
  return { migratedCount: result.claimed };
}
