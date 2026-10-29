import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import worker from '../rate-limit-worker.js';

const BUCKET_BINDINGS = {
  upload: 'UPLOAD_LIMIT',
  parts: 'PARTS_LIMIT',
  download: 'DOWNLOAD_LIMIT',
  password: 'PASSWORD_LIMIT',
  claim: 'CLAIM_LIMIT',
  delete: 'DELETE_LIMIT',
  request: 'REQUEST_LIMIT',
  email: 'EMAIL_LIMIT',
};

function mockLimiter(success) {
  const calls = [];
  return {
    calls,
    limit: async ({ key }) => {
      calls.push(key);
      return { success };
    },
  };
}

function createEnv(success = true) {
  const env = {};
  for (const binding of Object.values(BUCKET_BINDINGS)) env[binding] = mockLimiter(success);
  return env;
}

async function post(body, env, { raw = false } = {}) {
  const request = new Request('https://rate-limit.internal/limit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });
  const response = await worker.fetch(request, env);
  const data = await response.json();
  return { status: response.status, data };
}

test('each allowlisted bucket reports the binding decision', async () => {
  const allowedEnv = createEnv(true);
  for (const [bucket, binding] of Object.entries(BUCKET_BINDINGS)) {
    const result = await post({ bucket, key: `key-${bucket}` }, allowedEnv);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { allowed: true });
    assert.deepEqual(allowedEnv[binding].calls, [`key-${bucket}`]);
  }

  const blockedEnv = createEnv(false);
  const blocked = await post({ bucket: 'password', key: 'share-a' }, blockedEnv);
  assert.equal(blocked.status, 200);
  assert.deepEqual(blocked.data, { allowed: false });
  assert.deepEqual(blockedEnv.PASSWORD_LIMIT.calls, ['share-a']);
  assert.equal(blockedEnv.UPLOAD_LIMIT.calls.length, 0);
});

test('invalid buckets and keys are rejected before any binding is called', async () => {
  const env = createEnv(true);
  const invalidBucket = await post({ bucket: 'quota', key: '1.2.3.4' }, env);
  assert.equal(invalidBucket.status, 400);
  assert.equal(invalidBucket.data.allowed, false);
  assert.equal(invalidBucket.data.error, 'Invalid bucket.');

  const missingKey = await post({ bucket: 'upload' }, env);
  assert.equal(missingKey.status, 400);
  assert.equal(missingKey.data.error, 'Invalid key.');

  const emptyKey = await post({ bucket: 'upload', key: '' }, env);
  assert.equal(emptyKey.status, 400);

  const numericKey = await post({ bucket: 'upload', key: 15 }, env);
  assert.equal(numericKey.status, 400);

  const oversizedKey = await post({ bucket: 'upload', key: 'k'.repeat(257) }, env);
  assert.equal(oversizedKey.status, 400);
  assert.equal(oversizedKey.data.allowed, false);

  for (const binding of Object.values(env)) assert.equal(binding.calls.length, 0);
});

test('malformed JSON and oversized bodies are rejected', async () => {
  const env = createEnv(true);
  const malformed = await post('{', env, { raw: true });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.data.allowed, false);
  assert.equal(malformed.data.error, 'Invalid JSON.');

  const oversized = await post(`{"bucket":"upload","key":"${'k'.repeat(2000)}"}`, env, { raw: true });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.data.allowed, false);
  for (const binding of Object.values(env)) assert.equal(binding.calls.length, 0);
});

test('binding failures return 503 and do not allow the request', async () => {
  const env = createEnv(true);
  env.PASSWORD_LIMIT = {
    calls: [],
    limit: async () => {
      throw new Error('namespace 910004 unavailable');
    },
  };
  const thrown = await post({ bucket: 'password', key: 'share-a' }, env);
  assert.equal(thrown.status, 503);
  assert.deepEqual(thrown.data, { allowed: false, error: 'Limiter unavailable.' });
  assert.equal(JSON.stringify(thrown.data).includes('910004'), false);

  delete env.EMAIL_LIMIT;
  const missing = await post({ bucket: 'email', key: '203.0.113.8' }, env);
  assert.equal(missing.status, 503);
  assert.equal(missing.data.allowed, false);

  env.UPLOAD_LIMIT = { limit: async () => ({}) };
  const malformedResult = await post({ bucket: 'upload', key: '203.0.113.9' }, env);
  assert.equal(malformedResult.status, 503);
  assert.equal(malformedResult.data.allowed, false);
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

test('password attempts use the configured threshold and window for one key', async () => {
  const policy = passwordLimitPolicy();
  let now = 0;
  const env = createCountingEnv(policy, () => now);
  const key = 'share-and-ip';

  for (let attempt = 0; attempt < policy.limit; attempt += 1) {
    const allowed = await post({ bucket: policy.bucket, key }, env);
    assert.equal(allowed.status, 200, `attempt ${attempt + 1}`);
    assert.deepEqual(allowed.data, { allowed: true }, `attempt ${attempt + 1}`);
  }

  const blocked = await post({ bucket: policy.bucket, key }, env);
  assert.equal(blocked.status, 200);
  assert.deepEqual(blocked.data, { allowed: false });

  const otherKey = await post({ bucket: policy.bucket, key: 'other-share-or-ip' }, env);
  assert.deepEqual(otherKey.data, { allowed: true });

  now += policy.periodSeconds * 1000;
  const reset = await post({ bucket: policy.bucket, key }, env);
  assert.equal(reset.status, 200);
  assert.deepEqual(reset.data, { allowed: true });

  assert.equal(env.calls.every((call) => call.binding === policy.bindingName), true);
  assert.equal(env.calls.filter((call) => call.key === key).length, policy.limit + 2);
});
