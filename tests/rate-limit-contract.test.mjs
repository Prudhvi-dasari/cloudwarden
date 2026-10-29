import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { onRequest as sendEmail } from '../functions/api/send-email.js';
import { checkSharedLimit } from '../functions/lib/rateLimit.js';
import worker from '../rate-limit-worker.js';

const LIMIT_URL = 'https://itransfer-rate-limit.internal/';
const BINDINGS = {
  upload: 'UPLOAD_LIMIT',
  parts: 'PARTS_LIMIT',
  download: 'DOWNLOAD_LIMIT',
  password: 'PASSWORD_LIMIT',
  claim: 'CLAIM_LIMIT',
  delete: 'DELETE_LIMIT',
  request: 'REQUEST_LIMIT',
  email: 'EMAIL_LIMIT',
};

function cloudflareLimiter(success, calls) {
  return {
    limit: async ({ key }) => {
      calls.push(key);
      return { success };
    },
  };
}

function workerEnv(success = true) {
  const calls = [];
  const env = { calls };
  for (const name of Object.values(BINDINGS)) env[name] = cloudflareLimiter(success, calls);
  return env;
}

function pagesBinding(targetEnv) {
  const calls = [];
  return {
    calls,
    async fetch(url, init) {
      calls.push({
        url: String(url),
        method: init.method,
        contentType: init.headers?.['content-type'] || init.headers?.get?.('content-type') || '',
        body: init.body,
      });
      return worker.fetch(new Request(url, init), targetEnv);
    },
  };
}

test('Pages and the local Worker use the same allow and block protocol', async () => {
  const allowedEnv = workerEnv(true);
  const binding = pagesBinding(allowedEnv);
  const allowed = await checkSharedLimit({ RATE_LIMITER: binding }, 'upload', '198.51.100.10');
  assert.deepEqual(allowed, { allowed: true });
  assert.equal(binding.calls.length, 1);
  assert.equal(binding.calls[0].url, LIMIT_URL);
  assert.equal(binding.calls[0].method, 'POST');
  assert.equal(binding.calls[0].contentType, 'application/json');
  assert.deepEqual(JSON.parse(binding.calls[0].body), { bucket: 'upload', key: '198.51.100.10' });
  assert.deepEqual(allowedEnv.calls, ['198.51.100.10']);

  const blockedEnv = workerEnv(false);
  const blockedBinding = pagesBinding(blockedEnv);
  const blocked = await checkSharedLimit({ RATE_LIMITER: blockedBinding }, 'email', '198.51.100.11');
  assert.deepEqual(blocked, { allowed: false, blocked: true });
  assert.equal(blockedEnv.EMAIL_LIMIT.limit === undefined, false);
  assert.deepEqual(blockedEnv.calls, ['198.51.100.11']);
});

test('Worker failures and malformed allow decisions stay unavailable', async () => {
  const scripted = (response) => ({
    async fetch() {
      if (typeof response === 'function') return response();
      return response;
    },
  });

  const missing = await checkSharedLimit({}, 'upload', '198.51.100.12');
  assert.deepEqual(missing, { allowed: false, unavailable: true });

  const noFetch = await checkSharedLimit({ RATE_LIMITER: {} }, 'upload', '198.51.100.12');
  assert.equal(noFetch.unavailable, true);

  const thrown = await checkSharedLimit({
    RATE_LIMITER: { fetch: async () => { throw new Error('limiter down'); } },
  }, 'download', '198.51.100.12');
  assert.deepEqual(thrown, { allowed: false, unavailable: true });

  const timedOut = await checkSharedLimit({
    RATE_LIMITER: { fetch: async () => { throw new DOMException('The operation was aborted.', 'TimeoutError'); } },
  }, 'parts', '198.51.100.12');
  assert.equal(timedOut.unavailable, true);
  assert.equal(timedOut.blocked, undefined);

  const non200 = await checkSharedLimit({
    RATE_LIMITER: scripted(new Response(JSON.stringify({ allowed: true }), { status: 503 })),
  }, 'claim', '198.51.100.12');
  assert.equal(non200.unavailable, true);

  const invalidJson = await checkSharedLimit({
    RATE_LIMITER: scripted(new Response('not-json', { status: 200 })),
  }, 'delete', '198.51.100.12');
  assert.equal(invalidJson.unavailable, true);

  const missingAllowed = await checkSharedLimit({
    RATE_LIMITER: scripted(new Response(JSON.stringify({ success: true }), { status: 200 })),
  }, 'request', '198.51.100.12');
  assert.equal(missingAllowed.unavailable, true);

  const nullAllowed = await checkSharedLimit({
    RATE_LIMITER: scripted(new Response(JSON.stringify({ allowed: null }), { status: 200 })),
  }, 'email', '198.51.100.12');
  assert.equal(nullAllowed.unavailable, true);

  const stringAllowed = await checkSharedLimit({
    RATE_LIMITER: scripted(new Response(JSON.stringify({ allowed: 'true' }), { status: 200 })),
  }, 'upload', '198.51.100.12');
  assert.equal(stringAllowed.unavailable, true);
  assert.equal(stringAllowed.allowed, false);
});

test('an unknown bucket from the caller is unavailable and does not count as allowed', async () => {
  const target = workerEnv(true);
  const binding = pagesBinding(target);
  const result = await checkSharedLimit({ RATE_LIMITER: binding }, 'quota', '198.51.100.13');
  assert.deepEqual(result, { allowed: false, unavailable: true });
  assert.equal(target.calls.length, 0);
});

test('a Worker storage failure is unavailable to Pages', async () => {
  const target = workerEnv(true);
  target.UPLOAD_LIMIT = {
    limit: async () => {
      throw new Error('namespace unavailable');
    },
  };
  const thrown = await checkSharedLimit({ RATE_LIMITER: pagesBinding(target) }, 'upload', '198.51.100.14');
  assert.deepEqual(thrown, { allowed: false, unavailable: true });

  delete target.DOWNLOAD_LIMIT;
  const missingBinding = await checkSharedLimit({ RATE_LIMITER: pagesBinding(target) }, 'download', '198.51.100.15');
  assert.equal(missingBinding.unavailable, true);

  target.PARTS_LIMIT = { limit: async () => ({}) };
  const malformed = await checkSharedLimit({ RATE_LIMITER: pagesBinding(target) }, 'parts', '198.51.100.16');
  assert.equal(malformed.unavailable, true);
});

test('send-email holds the message when the binding is missing or the Worker rejects it', async () => {
  const original = globalThis.fetch;
  const resendCalls = [];
  globalThis.fetch = async (url) => {
    resendCalls.push(String(url));
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  };
  const mailEnv = {
    RESEND_API_KEY: 're_test',
    APP_URL: 'https://itransfer.iprudhvi.in',
  };
  const send = (env) => {
    const request = new Request('https://itransfer.iprudhvi.in/api/send-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.20' },
      body: JSON.stringify({ shareId: 'mail-share', recipientEmails: 'a@example.com' }),
    });
    return sendEmail({ request, env }).then(async (response) => ({
      status: response.status,
      data: await response.json(),
    }));
  };
  try {
    const missing = await send(mailEnv);
    assert.equal(missing.status, 200);
    assert.equal(missing.data.reason, 'limiter_unavailable');
    assert.equal(missing.data.provider, 'client_fallback');
    assert.equal(resendCalls.length, 0);

    const blockedEnv = workerEnv(false);
    const blocked = await send({ ...mailEnv, RATE_LIMITER: pagesBinding(blockedEnv) });
    assert.equal(blocked.status, 200);
    assert.equal(blocked.data.reason, 'rate_limited');
    assert.equal(resendCalls.length, 0);
    assert.deepEqual(blockedEnv.calls, ['198.51.100.20']);

    const allowedEnv = workerEnv(true);
    const allowed = await send({ ...mailEnv, RATE_LIMITER: pagesBinding(allowedEnv) });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.data.status, 'accepted');
    assert.equal(resendCalls.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

function parseJsonc(text) {
  return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
}

function passwordLimitPolicy() {
  const workerSource = readFileSync(new URL('../rate-limit-worker.js', import.meta.url), 'utf8');
  const engineSource = readFileSync(new URL('../functions/lib/r2Engine.js', import.meta.url), 'utf8');
  const config = parseJsonc(readFileSync(new URL('../wrangler.rate-limit.jsonc', import.meta.url), 'utf8'));
  const names = [...engineSource.matchAll(/checkSharedLimit\(\s*env\s*,\s*'([^']+)'\s*,\s*(?:await passwordLimitKey|limitKey)\b/g)].map((match) => match[1]);
  if (names.length !== 2 || names[1] !== names[0]) {
    throw new Error(`Expected verify-password and download-url to share one password bucket, found ${names.join(', ') || 'none'}.`);
  }
  const buckets = new Map();
  for (const match of workerSource.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([A-Z0-9_]+)',?\s*$/gm)) {
    buckets.set(match[1], match[2]);
  }
  const bucket = names[0];
  const bindingName = buckets.get(bucket);
  const entry = (config.ratelimits || []).find((item) => item.name === bindingName);
  const limit = entry?.simple?.limit;
  const periodSeconds = entry?.simple?.period;
  if (!bindingName || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(periodSeconds) || periodSeconds < 1) {
    throw new Error('Password rate limit is not configured in the Worker and wrangler.rate-limit.jsonc.');
  }
  return { bucket, bindingName, limit, periodSeconds, ratelimits: config.ratelimits };
}

function createCountingEnv(policy, now = () => Date.now()) {
  const calls = [];
  const windows = new Map();
  const env = { calls };
  for (const entry of policy.ratelimits) {
    const bindingName = entry.name;
    const limit = entry.simple.limit;
    const periodMs = entry.simple.period * 1000;
    env[bindingName] = {
      async limit({ key }) {
        calls.push({ binding: bindingName, key });
        const id = `${bindingName}\0${key}`;
        const timestamp = now();
        let record = windows.get(id);
        if (!record || timestamp - record.windowStart >= periodMs) {
          record = { windowStart: timestamp, count: 0 };
          windows.set(id, record);
        }
        record.count += 1;
        return { success: record.count <= limit };
      },
    };
  }
  return env;
}

test('password checks through the Worker allow the configured threshold and then block', async () => {
  const policy = passwordLimitPolicy();
  const target = createCountingEnv(policy);
  const binding = pagesBinding(target);
  const key = 'same-password-key';

  for (let attempt = 0; attempt < policy.limit; attempt += 1) {
    const allowed = await checkSharedLimit({ RATE_LIMITER: binding }, policy.bucket, key);
    assert.deepEqual(allowed, { allowed: true }, `attempt ${attempt + 1}`);
  }

  const blocked = await checkSharedLimit({ RATE_LIMITER: binding }, policy.bucket, key);
  assert.deepEqual(blocked, { allowed: false, blocked: true });
  assert.equal(blocked.unavailable, undefined);

  const passwordCalls = target.calls.filter((call) => call.binding === policy.bindingName && call.key === key);
  assert.equal(passwordCalls.length, policy.limit + 1);
  assert.equal(binding.calls.length, policy.limit + 1);
  for (const call of binding.calls) {
    assert.deepEqual(JSON.parse(call.body), { bucket: policy.bucket, key });
  }
});
