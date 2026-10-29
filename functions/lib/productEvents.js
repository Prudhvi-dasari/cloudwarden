/** Product events. No emails, names, IP addresses, or payment ids. */

export const PRODUCT_EVENTS = new Set([
  'upload_started',
  'upload_completed',
  'upload_failed',
  'upload_resumed',
  'link_created',
  'download',
  'signup',
  'checkout_started',
  'payment_succeeded',
  'quota_hit',
  'cap_hit',
]);

const TIERS = new Set(['free', 'creator', 'pro', 'studio', 'pass']);
const recent = new Map();

export function sanitizeProductEvent(input) {
  const event = typeof input?.event === 'string' ? input.event : '';
  if (!PRODUCT_EVENTS.has(event)) return null;
  const tier = TIERS.has(input?.tier) ? input.tier : null;
  const bytes = Number(input?.bytes);
  return {
    event,
    tier,
    bytes: Number.isFinite(bytes) && bytes >= 0 && bytes < 10_000_000_000_000 ? Math.floor(bytes) : null,
  };
}

/** Per-isolate cap so a client cannot flood the events table. */
export function allowProductEvent(ip, now = Date.now()) {
  const key = String(ip || 'unknown');
  const windowMs = 60_000;
  const limit = 60;
  const current = recent.get(key);
  if (!current || now - current.start > windowMs) {
    recent.set(key, { start: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function envGet(env, key) {
  if (env && env[key]) return env[key];
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  return '';
}

export async function recordProductEvent(env, input) {
  const clean = sanitizeProductEvent(input);
  if (!clean) return;
  const key = envGet(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const base = envGet(env, 'SUPABASE_URL').replace(/\/$/, '');
  if (!key || !base) return;
  try {
    await fetch(`${base}/rest/v1/sta_product_events`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        event: clean.event,
        tier: clean.tier,
        bytes: clean.bytes,
      }),
    });
  } catch {
    // Analytics must not block a transfer.
  }
}
