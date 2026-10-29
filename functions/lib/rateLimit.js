/**
 * Client for the internal itransfer-rate-limit Worker.
 *
 * A result is allowed only when the service binding returns HTTP 200 and
 * JSON whose `allowed` field is boolean true. Timeouts, missing bindings,
 * non-200 responses, and malformed JSON are unavailable, never allowed.
 *
 * Callers fail closed on that result. An unavailable limiter does not sign
 * part URLs. An explicit block is still HTTP 429.
 *
 * request-meta and share-meta use the same fail-closed policy: 429 when
 * the Worker blocks, 503 when the check is unavailable. They do not read
 * the record unless the Worker explicitly allows the request.
 */

const LIMIT_URL = 'https://itransfer-rate-limit.internal/';

export function trustedClientIp(request) {
  const ip = String(request?.headers?.get('cf-connecting-ip') || '').trim();
  return ip || '0.0.0.0';
}

export async function checkSharedLimit(env, bucket, key) {
  const binding = env?.RATE_LIMITER;
  if (!binding || typeof binding.fetch !== 'function') {
    return { allowed: false, unavailable: true };
  }

  let response;
  try {
    response = await binding.fetch(LIMIT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket, key }),
    });
  } catch {
    return { allowed: false, unavailable: true };
  }

  if (!response || response.status !== 200) return { allowed: false, unavailable: true };

  let data;
  try {
    data = await response.json();
  } catch {
    return { allowed: false, unavailable: true };
  }
  if (!data || typeof data.allowed !== 'boolean') return { allowed: false, unavailable: true };
  if (data.allowed) return { allowed: true };
  return { allowed: false, blocked: true };
}
