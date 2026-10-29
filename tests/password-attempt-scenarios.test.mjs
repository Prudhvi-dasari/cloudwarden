import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { handleR2Request } from '../functions/lib/r2Engine.js';
import { claimDownloadSlot, releaseDownloadSlot } from '../functions/lib/transferReservation.js';
import { sha256Hex } from '../functions/lib/transferSecurity.js';
import worker from '../rate-limit-worker.js';

const CORRECT = 'correct-horse';
const WRONG = 'wrong-horse';
const passwordHash = await sha256Hex(CORRECT);

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

const policy = passwordLimitPolicy();

function createCountingEnv(now = () => Date.now()) {
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

function appEnv(extra = {}) {
  return {
    SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'publishable-test',
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct-test',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'access-test',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret-test',
    CLOUDFLARE_R2_BUCKET: 'test-bucket',
    CLOUDFLARE_R2_ENDPOINT: 'https://r2.test.local',
    CLOUDFLARE_R2_REGION: 'us-east-1',
    ...extra,
  };
}

function bindWorker(workerEnv) {
  const requests = [];
  const rateLimiter = {
    async fetch(url, init) {
      requests.push(JSON.parse(init.body));
      return worker.fetch(new Request(url, init), workerEnv);
    },
  };
  return { requests, env: appEnv({ RATE_LIMITER: rateLimiter }) };
}

function countingApp() {
  const workerEnv = createCountingEnv();
  return { workerEnv, ...bindWorker(workerEnv) };
}

function createState() {
  return { transfers: [], lookups: [], claims: [], blocked: [] };
}

function addTransfer(state, shareId, hash = passwordHash) {
  const row = {
    id: `id-${shareId}`,
    share_id: shareId,
    file_name: 'secret.txt',
    file_path: `transfers/t-${shareId}/secret.txt`,
    file_size: 4,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    password_hash: hash,
    max_downloads: 0,
    download_count: 0,
  };
  state.transfers.push(row);
  return row;
}

function columnEq(url, column) {
  const raw = url.searchParams.get(column);
  if (!raw || !raw.startsWith('eq.')) return null;
  return decodeURIComponent(raw.slice(3));
}

function installFetch(state) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    const parsed = new URL(href);
    if (parsed.hostname !== 'example.supabase.co') {
      state.blocked.push(href);
      return new Response(JSON.stringify({ error: 'outbound blocked' }), { status: 500 });
    }
    const method = options.method || 'GET';
    const table = parsed.pathname.split('/').filter(Boolean).at(-1);
    const body = options.body ? JSON.parse(options.body) : null;
    if (table === 'transfers' && method === 'GET') {
      const shareId = columnEq(parsed, 'share_id');
      const fileId = columnEq(parsed, 'id');
      state.lookups.push({ shareId, fileId });
      const rows = state.transfers.filter((row) => (
        (shareId == null || row.share_id === shareId)
        && (fileId == null || row.id === fileId)
      ));
      return new Response(JSON.stringify(rows), { status: 200 });
    }
    if (table === 'claim_download_slot' && method === 'POST') {
      state.claims.push(body);
      return new Response(JSON.stringify(claimDownloadSlot(state.transfers, body)), { status: 200 });
    }
    if (table === 'release_download_slot' && method === 'POST') {
      return new Response(JSON.stringify(releaseDownloadSlot(state.transfers, body)), { status: 200 });
    }
    state.blocked.push(href);
    return new Response(JSON.stringify({ error: 'unmocked' }), { status: 500 });
  };
  return () => {
    globalThis.fetch = original;
  };
}

function watchDigests() {
  const original = crypto.subtle.digest.bind(crypto.subtle);
  const inputs = [];
  crypto.subtle.digest = async (algorithm, data) => {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    inputs.push(new TextDecoder().decode(bytes));
    return original(algorithm, data);
  };
  return {
    count(value) {
      return inputs.filter((item) => item === value).length;
    },
    restore() {
      crypto.subtle.digest = original;
    },
  };
}

function installDoubles(state) {
  const restoreFetch = installFetch(state);
  const digests = watchDigests();
  return {
    digests,
    restore() {
      digests.restore();
      restoreFetch();
    },
  };
}

async function postPassword(env, { shareId, password, ip }) {
  const request = new Request('https://app.test.local/api/r2?action=verify-password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': ip,
    },
    body: JSON.stringify({ shareId, inputPassword: password }),
  });
  const response = await handleR2Request({ request, env });
  return { status: response.status, data: await response.json() };
}

async function getDownload(env, { shareId, fileId, password, ip }) {
  const request = new Request(
    `https://app.test.local/api/r2?action=download-url&shareId=${encodeURIComponent(shareId)}&fileId=${encodeURIComponent(fileId)}`,
    {
      method: 'GET',
      headers: {
        'cf-connecting-ip': ip,
        'x-transfer-password': password,
      },
    },
  );
  const response = await handleR2Request({ request, env });
  return { status: response.status, data: await response.json() };
}

function lookupsFor(state, shareId) {
  return state.lookups.filter((item) => item.shareId === shareId).length;
}

function assertClosed(result, expected, label) {
  assert.equal(result.status, expected.status, label);
  assert.equal(result.data.code, expected.code, label);
  assert.equal(result.data.success, undefined, label);
  assert.equal(result.data.downloadUrl, undefined, label);
  assert.equal(JSON.stringify(result.data).includes('X-Amz-Signature'), false, label);
}

describe('password attempt scenarios', { concurrency: false }, () => {
  test('verify-password allows the configured number of attempts and then returns RATE_LIMITED', async () => {
    const state = createState();
    const doubles = installDoubles(state);
    const shareId = 'pw-verify-1';
    const ip = '198.51.100.50';
    addTransfer(state, shareId);
    const { env, requests, workerEnv } = countingApp();
    const expectedKey = await sha256Hex(`itransfer-password\n${shareId}\n${ip}`);
    try {
      for (let attempt = 0; attempt < policy.limit; attempt += 1) {
        const result = await postPassword(env, { shareId, password: WRONG, ip });
        assert.equal(result.status, 401, `attempt ${attempt + 1}`);
        assert.equal(result.data.code, 'PASSWORD_INCORRECT', `attempt ${attempt + 1}`);
      }
      assert.equal(doubles.digests.count(WRONG), policy.limit);
      assert.equal(lookupsFor(state, shareId), policy.limit);

      for (let extra = 0; extra < 2; extra += 1) {
        const blocked = await postPassword(env, { shareId, password: WRONG, ip });
        assertClosed(blocked, { status: 429, code: 'RATE_LIMITED' }, `attempt ${policy.limit + extra + 1}`);
      }
      assert.equal(doubles.digests.count(WRONG), policy.limit);
      assert.equal(lookupsFor(state, shareId), policy.limit);
      assert.equal(requests.length, policy.limit + 2);
      assert.equal(requests.every((item) => item.bucket === policy.bucket && item.key === expectedKey), true);
      assert.equal(JSON.stringify(requests).includes(WRONG), false);
      assert.equal(workerEnv.calls.filter((call) => call.binding === policy.bindingName && call.key === expectedKey).length, policy.limit + 2);
      assert.deepEqual(state.blocked, []);
    } finally {
      doubles.restore();
    }
  });

  test('protected download allows the configured number of attempts and then blocks before signing', async () => {
    const state = createState();
    const doubles = installDoubles(state);
    const shareId = 'dl-issue-1';
    const ip = '198.51.100.51';
    const row = addTransfer(state, shareId);
    const { env, requests } = countingApp();
    const expectedKey = await sha256Hex(`itransfer-password\n${shareId}\n${ip}`);
    try {
      const signed = await getDownload(env, { shareId, fileId: row.id, password: CORRECT, ip });
      assert.equal(signed.status, 200);
      assert.equal(typeof signed.data.downloadUrl, 'string');
      assert.equal(signed.data.downloadUrl.includes('X-Amz-Signature'), true);
      assert.equal(signed.data.downloadUrl.includes('secret.txt'), true);
      assert.equal(signed.data.downloadUrl.includes(CORRECT), false);
      assert.equal(row.download_count, 1);
      assert.equal(doubles.digests.count(CORRECT), 1);

      for (let attempt = 1; attempt < policy.limit; attempt += 1) {
        const result = await getDownload(env, { shareId, fileId: row.id, password: WRONG, ip });
        assert.equal(result.status, 401, `attempt ${attempt + 1}`);
        assert.equal(result.data.code, 'PASSWORD_INCORRECT', `attempt ${attempt + 1}`);
        assert.equal(result.data.downloadUrl, undefined, `attempt ${attempt + 1}`);
        assert.equal(JSON.stringify(result.data).includes('X-Amz-Signature'), false, `attempt ${attempt + 1}`);
      }
      assert.equal(doubles.digests.count(WRONG), policy.limit - 1);
      assert.equal(row.download_count, 1);
      assert.equal(state.claims.length, 1);

      const blocked = await getDownload(env, { shareId, fileId: row.id, password: CORRECT, ip });
      assertClosed(blocked, { status: 429, code: 'RATE_LIMITED' }, 'attempt beyond threshold');
      assert.equal(doubles.digests.count(CORRECT), 1);
      assert.equal(row.download_count, 1);
      assert.equal(state.claims.length, 1);
      const passwordRequests = requests.filter((item) => item.bucket === policy.bucket);
      assert.equal(passwordRequests.length, policy.limit + 1);
      assert.equal(passwordRequests.every((item) => item.key === expectedKey), true);
      assert.equal(JSON.stringify(requests).includes(CORRECT), false);
      assert.equal(JSON.stringify(requests).includes(WRONG), false);
      assert.deepEqual(state.blocked, []);
    } finally {
      doubles.restore();
    }
  });

  test('verify-password and protected download issuance share one password bucket and counter', async () => {
    const state = createState();
    const doubles = installDoubles(state);
    const shareId = 'shared-pw-1';
    const ip = '198.51.100.52';
    const row = addTransfer(state, shareId);
    const { env, requests, workerEnv } = countingApp();
    const expectedKey = await sha256Hex(`itransfer-password\n${shareId}\n${ip}`);
    try {
      for (let attempt = 0; attempt < policy.limit - 1; attempt += 1) {
        const result = await postPassword(env, { shareId, password: WRONG, ip });
        assert.equal(result.status, 401, `verify attempt ${attempt + 1}`);
        assert.equal(result.data.code, 'PASSWORD_INCORRECT', `verify attempt ${attempt + 1}`);
      }
      const stillAllowed = await getDownload(env, { shareId, fileId: row.id, password: WRONG, ip });
      assert.equal(stillAllowed.status, 401);
      assert.equal(stillAllowed.data.code, 'PASSWORD_INCORRECT');
      assert.equal(stillAllowed.data.downloadUrl, undefined);

      const blocked = await getDownload(env, { shareId, fileId: row.id, password: CORRECT, ip });
      assertClosed(blocked, { status: 429, code: 'RATE_LIMITED' }, 'shared bucket exhausted');
      assert.equal(doubles.digests.count(CORRECT), 0);
      assert.equal(doubles.digests.count(WRONG), policy.limit);
      assert.equal(row.download_count, 0);
      assert.equal(state.claims.length, 0);

      const passwordRequests = requests.filter((item) => item.bucket === policy.bucket);
      assert.equal(passwordRequests.length, policy.limit + 1);
      assert.equal(new Set(passwordRequests.map((item) => item.bucket)).size, 1);
      assert.equal(passwordRequests[0].bucket, policy.bucket);
      assert.equal(passwordRequests.every((item) => item.key === expectedKey), true);
      assert.equal(requests.slice(0, policy.limit - 1).every((item) => item.bucket === policy.bucket), true);
      assert.equal(workerEnv.calls.filter((call) => call.binding === policy.bindingName && call.key === expectedKey).length, policy.limit + 1);
      assert.deepEqual(state.blocked, []);
    } finally {
      doubles.restore();
    }
  });

  test('a missing, throwing, or non-allow limiter returns RATE_LIMIT_UNAVAILABLE before comparison or signing', async () => {
    const state = createState();
    const doubles = installDoubles(state);
    const ip = '198.51.100.54';
    const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
    const scripted = (respond) => {
      const requests = [];
      const rateLimiter = {
        async fetch(_url, init) {
          requests.push(JSON.parse(init.body));
          return respond();
        },
      };
      return { requests, env: appEnv({ RATE_LIMITER: rateLimiter }) };
    };
    const passwordBinding = (limit) => {
      const workerEnv = createCountingEnv();
      const seen = [];
      workerEnv[policy.bindingName] = {
        async limit({ key }) {
          seen.push(key);
          return limit();
        },
      };
      const bound = bindWorker(workerEnv);
      bound.seen = seen;
      return bound;
    };
    const cases = [
      {
        name: 'missing limiter binding',
        status: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        loadsRow: false,
        build: () => ({ requests: null, env: appEnv() }),
      },
      {
        name: 'limiter fetch throws',
        status: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        loadsRow: false,
        build: () => scripted(() => { throw new Error('limiter down'); }),
      },
      {
        name: 'limiter returns a non-200 result',
        status: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        loadsRow: false,
        build: () => scripted(() => jsonResponse(503, { allowed: true })),
      },
      {
        name: 'limiter returns a non-boolean allowed value',
        status: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        loadsRow: false,
        build: () => scripted(() => jsonResponse(200, { allowed: 'false' })),
      },
      {
        name: 'limiter returns a non-allow result without an explicit block',
        status: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        loadsRow: false,
        build: () => scripted(() => jsonResponse(200, { success: false })),
      },
      {
        name: 'explicit limiter block',
        status: 429,
        code: 'RATE_LIMITED',
        loadsRow: false,
        build: () => scripted(() => jsonResponse(200, { allowed: false })),
      },
      {
        name: 'password binding throws',
        status: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        loadsRow: true,
        build: () => passwordBinding(() => { throw new Error('namespace unavailable'); }),
      },
      {
        name: 'password binding returns a non-boolean success',
        status: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        loadsRow: true,
        build: () => passwordBinding(() => ({ success: 'true' })),
      },
      {
        name: 'password binding returns allowed false without a success boolean',
        status: 503,
        code: 'RATE_LIMIT_UNAVAILABLE',
        loadsRow: true,
        build: () => passwordBinding(() => ({ allowed: false })),
      },
      {
        name: 'password binding explicitly blocks',
        status: 429,
        code: 'RATE_LIMITED',
        loadsRow: true,
        build: () => passwordBinding(() => ({ success: false })),
      },
    ];
    try {
      for (const [index, item] of cases.entries()) {
        const shareId = `gate-${index}`;
        const row = addTransfer(state, shareId);
        const built = item.build();
        const beforeHash = doubles.digests.count(CORRECT);
        const beforeLookup = lookupsFor(state, shareId);
        const beforeClaims = state.claims.length;
        const beforeRequests = built.requests?.length || 0;

        const verified = await postPassword(built.env, { shareId, password: CORRECT, ip });
        assertClosed(verified, item, `${item.name} verify-password`);
        assert.equal(doubles.digests.count(CORRECT), beforeHash, `${item.name} compared the password`);
        assert.equal(lookupsFor(state, shareId), beforeLookup, `${item.name} looked up the password`);
        if (built.requests) {
          assert.equal(built.requests.at(-1).bucket, policy.bucket, `${item.name} verify bucket`);
        }

        const downloaded = await getDownload(built.env, { shareId, fileId: row.id, password: CORRECT, ip });
        assertClosed(downloaded, item, `${item.name} download-url`);
        assert.equal(doubles.digests.count(CORRECT), beforeHash, `${item.name} compared the password before signing`);
        assert.equal(row.download_count, 0, `${item.name} signed a download`);
        assert.equal(state.claims.length, beforeClaims, `${item.name} claimed a download slot`);
        assert.equal(lookupsFor(state, shareId), beforeLookup + (item.loadsRow ? 1 : 0), `${item.name} lookup`);
        if (item.loadsRow) {
          assert.equal(built.requests.at(-1).bucket, policy.bucket, `${item.name} download password bucket`);
        }
        if (built.requests) assert.equal(built.requests.length > beforeRequests, true, `${item.name} did not call the limiter`);
      }
      assert.deepEqual(state.blocked, []);
    } finally {
      doubles.restore();
    }
  });

  test('a nonexistent share id still counts against the shared password bucket', async () => {
    const state = createState();
    const doubles = installDoubles(state);
    const fakeId = 'fake-share-404';
    const realId = 'real-share-404';
    const ip = '198.51.100.53';
    addTransfer(state, realId);
    const { env, requests, workerEnv } = countingApp();
    const fakeKey = await sha256Hex(`itransfer-password\n${fakeId}\n${ip}`);
    const realKey = await sha256Hex(`itransfer-password\n${realId}\n${ip}`);
    try {
      const real = await postPassword(env, { shareId: realId, password: WRONG, ip });
      assert.equal(real.status, 401);
      assert.equal(real.data.code, 'PASSWORD_INCORRECT');
      assert.equal(requests[0].bucket, policy.bucket);
      assert.equal(requests[0].key, realKey);

      for (let attempt = 0; attempt < policy.limit; attempt += 1) {
        const result = await postPassword(env, { shareId: fakeId, password: WRONG, ip });
        assert.equal(result.status, 401, `fake attempt ${attempt + 1}`);
        assert.equal(result.data.code, 'PASSWORD_INCORRECT', `fake attempt ${attempt + 1}`);
      }
      assert.equal(lookupsFor(state, fakeId), policy.limit);

      for (let extra = 0; extra < 2; extra += 1) {
        const blocked = await postPassword(env, { shareId: fakeId, password: WRONG, ip });
        assertClosed(blocked, { status: 429, code: 'RATE_LIMITED' }, `fake attempt ${policy.limit + extra + 1}`);
      }
      assert.equal(lookupsFor(state, fakeId), policy.limit);

      const fakeRequests = requests.filter((item) => item.key === fakeKey);
      assert.equal(fakeRequests.length, policy.limit + 2);
      assert.equal(fakeRequests.every((item) => item.bucket === policy.bucket), true);
      assert.equal(fakeRequests[0].bucket, requests[0].bucket);
      assert.notEqual(fakeKey, realKey);
      assert.equal(workerEnv.calls.filter((call) => call.binding === policy.bindingName && call.key === fakeKey).length, policy.limit + 2);
      assert.equal(JSON.stringify(fakeRequests).includes(WRONG), false);
      assert.equal(JSON.stringify(fakeRequests).includes(fakeId), false);

      const realAgain = await postPassword(env, { shareId: realId, password: WRONG, ip });
      assert.equal(realAgain.status, 401);
      assert.equal(realAgain.data.code, 'PASSWORD_INCORRECT');
      assert.deepEqual(state.blocked, []);
    } finally {
      doubles.restore();
    }
  });
});
