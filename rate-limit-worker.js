/**
 * Internal rate-limit Worker. Pages calls this later through a service binding.
 * It has no public route. Binding failures return 503 and never count as allowed.
 */

const MAX_BODY_BYTES = 1024;
const MAX_KEY_LENGTH = 256;

const BUCKETS = Object.freeze({
  upload: 'UPLOAD_LIMIT',
  parts: 'PARTS_LIMIT',
  download: 'DOWNLOAD_LIMIT',
  password: 'PASSWORD_LIMIT',
  claim: 'CLAIM_LIMIT',
  delete: 'DELETE_LIMIT',
  request: 'REQUEST_LIMIT',
  email: 'EMAIL_LIMIT',
});

function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function denied(status, error) {
  return respond(status, { allowed: false, error });
}

async function readBody(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { error: 'too_large' };
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) return { error: 'too_large' };
  if (bytes.byteLength === 0) return { error: 'invalid_json' };
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: 'invalid_json' };
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return denied(405, 'POST required.');

    const body = await readBody(request);
    if (body.error === 'too_large') return denied(413, 'Request is too large.');
    if (body.error || !body.value || typeof body.value !== 'object' || Array.isArray(body.value)) {
      return denied(400, 'Invalid JSON.');
    }

    const bucket = body.value.bucket;
    const bindingName = typeof bucket === 'string' ? BUCKETS[bucket] : undefined;
    if (!bindingName) return denied(400, 'Invalid bucket.');

    const key = body.value.key;
    if (typeof key !== 'string' || key.length === 0 || key.length > MAX_KEY_LENGTH) {
      return denied(400, 'Invalid key.');
    }

    const limiter = env?.[bindingName];
    if (!limiter || typeof limiter.limit !== 'function') return denied(503, 'Limiter unavailable.');

    let result;
    try {
      result = await limiter.limit({ key });
    } catch {
      return denied(503, 'Limiter unavailable.');
    }
    if (!result || typeof result.success !== 'boolean') return denied(503, 'Limiter unavailable.');

    return respond(200, { allowed: result.success });
  },
};
