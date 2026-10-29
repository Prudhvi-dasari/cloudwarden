/**
 * Internal rate-limit Worker. Pages calls this later through a service binding.
 * It has no public route. Binding failures return 503 and never count as allowed.
 * Password attempts use a strict Durable Object. Every other bucket uses its native binding.
 */

const MAX_BODY_BYTES = 1024;
const MAX_KEY_LENGTH = 256;
const PASSWORD_LIMIT_URL = 'https://password-limit.internal/';

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

export const PASSWORD_ATTEMPT_LIMIT = 8;
export const PASSWORD_WINDOW_MS = 60_000;

export function consumePasswordAttempt(sql, nowMs) {
  if (!Number.isFinite(nowMs)) throw new Error('Invalid timestamp.');
  const cutoff = nowMs - PASSWORD_WINDOW_MS;
  sql.exec('DELETE FROM password_attempts WHERE at_ms <= ?', cutoff);
  const row = sql.exec('SELECT COUNT(*) AS n FROM password_attempts WHERE at_ms > ?', cutoff).one();
  const count = Number(row?.n);
  if (!Number.isInteger(count) || count < 0) throw new Error('Invalid count.');
  if (count >= PASSWORD_ATTEMPT_LIMIT) return false;
  sql.exec('INSERT INTO password_attempts (at_ms) VALUES (?)', nowMs);
  return true;
}

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

function readPasswordDecision(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (typeof payload.allowed !== 'boolean') return null;
  return payload.allowed;
}

async function limitPassword(env, key) {
  try {
    const namespace = env?.PASSWORD_LIMIT_DO;
    if (!namespace || typeof namespace.idFromName !== 'function' || typeof namespace.get !== 'function') {
      const binding = env?.[BUCKETS.password];
      if (binding && typeof binding.limit === 'function') {
        const decision = await binding.limit({ key });
        if (!decision || typeof decision.success !== 'boolean') return denied(503, 'Limiter unavailable.');
        return respond(200, { allowed: decision.success });
      }
      return denied(503, 'Limiter unavailable.');
    }
    const stub = namespace.get(namespace.idFromName(key));
    if (!stub || typeof stub.fetch !== 'function') return denied(503, 'Limiter unavailable.');
    const response = await stub.fetch(PASSWORD_LIMIT_URL);
    if (!response || response.status !== 200) return denied(503, 'Limiter unavailable.');
    const allowed = readPasswordDecision(await response.json());
    if (typeof allowed !== 'boolean') return denied(503, 'Limiter unavailable.');
    return respond(200, { allowed });
  } catch {
    return denied(503, 'Limiter unavailable.');
  }
}

export class PasswordRateLimit {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.pending = Promise.resolve();
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS password_attempts (at_ms INTEGER NOT NULL)');
      ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS password_attempts_at ON password_attempts (at_ms)');
    });
  }

  runExclusive(task) {
    const result = this.pending.then(task, task);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  decide() {
    const allowed = this.ctx.storage.transactionSync(() => consumePasswordAttempt(this.ctx.storage.sql, Date.now()));
    if (typeof allowed !== 'boolean') return denied(503, 'Limiter unavailable.');
    return respond(200, { allowed });
  }

  async fetch() {
    try {
      return await this.runExclusive(() => {
        try {
          return this.decide();
        } catch {
          return denied(503, 'Limiter unavailable.');
        }
      });
    } catch {
      return denied(503, 'Limiter unavailable.');
    }
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

    // Password attempts are strict. Never call the native PASSWORD_LIMIT binding.
    if (bucket === 'password') return limitPassword(env, key);

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
