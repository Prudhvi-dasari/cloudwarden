const STORAGE_KEY = 'sb-giyeepztahdbsejsozog-auth-token';

function tokenFromRaw(raw) {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token || parsed?.currentSession?.access_token;
    return typeof token === 'string' ? token : '';
  } catch {
    return '';
  }
}

export function readStoredAccessToken(storage = globalThis.localStorage) {
  if (!storage?.getItem) return '';
  const direct = tokenFromRaw(storage.getItem(STORAGE_KEY));
  if (direct) return direct;
  const chunks = [];
  for (let index = 0; index < 8; index += 1) {
    const part = storage.getItem(`${STORAGE_KEY}.${index}`);
    if (part == null) break;
    chunks.push(part);
  }
  return tokenFromRaw(chunks.join(''));
}

export async function checkoutAccessToken(getSession, { timeoutMs = 1200 } = {}) {
  const stored = readStoredAccessToken();
  if (stored) return stored;
  if (typeof getSession !== 'function') return '';
  let timer;
  try {
    return await Promise.race([
      Promise.resolve()
        .then(() => getSession())
        .then((result) => result?.data?.session?.access_token || '')
        .catch(() => ''),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(''), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
