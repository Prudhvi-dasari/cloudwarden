const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function alertEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return '';
  return email;
}

export function shouldSendDownloadAlert({ mode = 'first', downloadCount = 0, optedOut = false } = {}) {
  if (optedOut) return false;
  const count = Number(downloadCount) || 0;
  if (count < 1) return false;
  if (mode === 'off') return false;
  if (mode === 'each') return true;
  return count === 1;
}

export async function alertToken(secret, email) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret || 'sendtoanyone-alert-v1')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(alertEmail(email)));
  return [...new Uint8Array(sig)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
