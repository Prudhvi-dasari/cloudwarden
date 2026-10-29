/**
 * Local Vite isolation. Networking is mocked. These tests must not contact
 * production Supabase or Cloudflare R2.
 */
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleR2Request } from '../functions/lib/r2Engine.js';
import {
  assessViteApi,
  createLocalRateLimiter,
  dispatchLocalViteRequest,
  parseEnvFile,
} from '../functions/lib/localIsolation.js';
import { sha256Hex } from '../functions/lib/transferSecurity.js';

const valid = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'local-publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-role',
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'local-publishable',
  CLOUDFLARE_R2_ENDPOINT: 'http://127.0.0.1:9000',
  CLOUDFLARE_R2_REGION: 'us-east-1',
  CLOUDFLARE_R2_ACCOUNT_ID: 'local-account',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'local-access',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'local-secret',
  CLOUDFLARE_R2_BUCKET: 'itransfer-local',
  APP_URL: 'http://127.0.0.1:5173',
};

let exclusiveTail = Promise.resolve();
function exclusive(fn) {
  const run = exclusiveTail.then(fn, fn);
  exclusiveTail = run.then(() => {}, () => {});
  return run;
}

function post(action, body = {}) {
  return new Request(`http://127.0.0.1/api/r2?action=${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function withFetch(mock, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('giyeepztahdbsejsozog.supabase.co') || href.includes('.r2.cloudflarestorage.com')) {
      throw new Error(`production network call ${href}`);
    }
    return mock(href, options || {});
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function signingKey(secret, dateStamp, region) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, dateStamp), region), 's3'), 'aws4_request');
}

function expectedPresignSignature({ url, secret, region, host }) {
  const marker = '&X-Amz-Signature=';
  const cut = url.lastIndexOf(marker);
  const unsigned = url.slice(0, cut);
  const queryStart = unsigned.indexOf('?');
  const canonicalQuery = unsigned.slice(queryStart + 1);
  const canonicalUri = unsigned.slice(unsigned.indexOf('/', unsigned.indexOf('://') + 3), queryStart);
  const amzDate = new URL(url).searchParams.get('X-Amz-Date');
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = `${amzDate.slice(0, 8)}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  return hmac(signingKey(secret, amzDate.slice(0, 8), region), stringToSign).toString('hex');
}

function restState() {
  return { claims: [], storage: [] };
}

async function localRest(href, options, state) {
  const url = new URL(href);
  if (url.port === '9000') {
    state.storage.push({ href, host: options.headers?.host });
    return new Response('<UploadId>upload-1</UploadId>', { status: 200 });
  }
  const database = (url.hostname === '127.0.0.1' && url.port === '54321') || url.hostname === 'example.supabase.co';
  if (!database) throw new Error(`unexpected network call ${href}`);
  if (url.pathname === '/rest/v1/transfer_claims' && options.method === 'POST') {
    state.claims.push(...JSON.parse(options.body));
    return new Response(options.body, { status: 201 });
  }
  if (url.pathname === '/rest/v1/transfer_claims') {
    const hash = url.searchParams.get('token_hash')?.replace(/^eq\./, '');
    const purpose = url.searchParams.get('purpose')?.replace(/^eq\./, '');
    return new Response(JSON.stringify(state.claims.filter((row) => row.token_hash === hash && row.purpose === purpose)), { status: 200 });
  }
  if (url.pathname === '/rest/v1/sta_product_events') return new Response('[]', { status: 201 });
  if (url.pathname === '/rest/v1/itransfer_accounts' || url.pathname === '/rest/v1/sta_transfer_passes' || url.pathname === '/rest/v1/billing_entitlements') {
    return new Response('[]', { status: 200 });
  }
  if (url.pathname === '/rest/v1/rpc/set_platform_storage_cap' || url.pathname === '/rest/v1/rpc/release_daily_upload') {
    return new Response('null', { status: 200 });
  }
  if (url.pathname === '/rest/v1/rpc/consume_daily_upload' && options.method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (url.pathname === '/rest/v1/rpc/reserve_transfer_file' && options.method === 'POST') {
    // Signing tests only. The share cap is enforced in transfer-reservation.postgres.mjs.
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify({
      ok: true,
      id: 'local-row',
      file_path: body.p_file_path,
      status: 'pending',
    }), { status: 200 });
  }
  if (url.pathname === '/rest/v1/transfers') {
    return new Response('[{}]', { status: options.method === 'POST' ? 201 : 200 });
  }
  throw new Error(`unexpected database call ${href}`);
}

test('ordinary Vite API mode rejects every transfer call before the network', () => exclusive(async () => {
  await withFetch(() => {
    throw new Error('fetch should not run');
  }, async (calls) => {
    const decision = assessViteApi({ isolated: false, env: valid });
    assert.equal(decision.ok, false);
    assert.equal(decision.limiterEnabled, false);
    assert.equal(decision.env.RATE_LIMITER, undefined);
    const response = await dispatchLocalViteRequest({
      isolated: false,
      env: valid,
      request: post('open-transfer'),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'LOCAL_API_DISABLED');
    assert.equal(calls.length, 0);
  });
}));

test('production Supabase configuration is rejected before any network call', () => exclusive(async () => {
  await withFetch(() => {
    throw new Error('fetch should not run');
  }, async (calls) => {
    const env = {
      ...valid,
      SUPABASE_URL: 'https://giyeepztahdbsejsozog.supabase.co',
      VITE_SUPABASE_URL: 'https://giyeepztahdbsejsozog.supabase.co',
    };
    const decision = assessViteApi({ isolated: true, env });
    assert.equal(decision.limiterEnabled, false);
    const response = await dispatchLocalViteRequest({
      isolated: true,
      env,
      request: post('cleanup'),
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, 'ISOLATED_CONFIG_INVALID');
    assert.match(body.error, /SUPABASE_URL/);
    const direct = await handleR2Request({
      request: post('open-transfer'),
      env: { ...env, ITRANSFER_ISOLATED: '1' },
    });
    assert.equal(direct.status, 503);
    assert.equal(calls.length, 0);
  });
}));

test('production R2 endpoint and bucket are rejected before any network call', () => exclusive(async () => {
  await withFetch(() => {
    throw new Error('fetch should not run');
  }, async (calls) => {
    const endpointEnv = {
      ...valid,
      CLOUDFLARE_R2_ENDPOINT: 'https://abc.r2.cloudflarestorage.com',
    };
    const bucketEnv = { ...valid, CLOUDFLARE_R2_BUCKET: 'itransfer-storage' };
    for (const env of [endpointEnv, bucketEnv]) {
      const decision = assessViteApi({ isolated: true, env });
      assert.equal(decision.limiterEnabled, false);
      const response = await dispatchLocalViteRequest({
        isolated: true,
        env,
        request: post('get-put-url', { fileName: 'notes.txt', fileSize: 20 }),
      });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'ISOLATED_CONFIG_INVALID');
    }
    assert.equal(calls.length, 0);
  });
}));

test('invalid or missing local configuration cannot enable the in-process limiter', () => {
  const example = parseEnvFile(readFileSync(new URL('../env/isolated.example', import.meta.url), 'utf8'));
  assert.equal(example.CLOUDFLARE_R2_BUCKET, 'itransfer-local');
  assert.doesNotMatch(readFileSync(new URL('../env/isolated.example', import.meta.url), 'utf8'), /giyeepztahdbsejsozog|itransfer-storage|r2\.cloudflarestorage\.com/);
  const cases = [
    {},
    example,
    { ...valid, SUPABASE_URL: 'http://127.0.0.1' },
    { ...valid, APP_URL: 'https://itransfer.iprudhvi.in' },
    { ...valid, CLOUDFLARE_R2_REGION: 'auto' },
    { ...valid, RESEND_API_KEY: 're_local' },
    { ...valid, CLEANUP_SECRET: 'cleanup' },
    { ...valid, CLEANUP_SECRET: 'production-looking-secret' },
    { ...valid, VITE_SUPABASE_SERVICE_ROLE_KEY: valid.SUPABASE_SERVICE_ROLE_KEY },
    { ...valid, VITE_SUPABASE_URL: 'http://127.0.0.1:54322' },
  ];
  for (const env of cases) {
    const decision = assessViteApi({ isolated: true, env });
    assert.equal(decision.ok, false, decision.body?.error);
    assert.equal(decision.limiterEnabled, false);
    assert.equal(decision.env.RATE_LIMITER, undefined);
  }
});

test('a local-prefixed cleanup secret stays server-side and enables the same header check', () => {
  const decision = assessViteApi({ isolated: true, env: { ...valid, CLEANUP_SECRET: 'local-cleanup-secret' } });
  assert.equal(decision.ok, true, decision.body?.error);
  assert.equal(decision.env.CLEANUP_SECRET, 'local-cleanup-secret');
  assert.equal(decision.env.VITE_CLEANUP_SECRET, undefined);
});

test('the local limiter enforces the same upload ceiling as the Worker', async () => {
  const limiter = createLocalRateLimiter();
  let lastAllowed = true;
  for (let count = 1; count <= 31; count += 1) {
    const response = await limiter.fetch('https://itransfer-rate-limit.internal/', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'upload', key: '0.0.0.0' }),
    });
    assert.equal(response.status, 200);
    lastAllowed = (await response.json()).allowed;
    if (count <= 30) assert.equal(lastAllowed, true);
  }
  assert.equal(lastAllowed, false);
});

test('presigned URLs and signed requests use the local endpoint canonical host', () => exclusive(async () => {
  const decision = assessViteApi({ isolated: true, env: valid });
  assert.equal(decision.limiterEnabled, true);
  const state = restState();
  await withFetch((href, options) => localRest(href, options, state), async (calls) => {
    const opened = await dispatchLocalViteRequest({
      isolated: true,
      env: valid,
      request: post('open-transfer', {}),
    });
    assert.equal(opened.status, 200);
    const { deleteToken } = await opened.json();
    const uploaded = await dispatchLocalViteRequest({
      isolated: true,
      env: valid,
      request: post('get-put-url', {
        fileName: 'notes.txt',
        fileSize: 20,
        contentType: 'text/plain',
        deleteToken,
      }),
    });
    assert.equal(uploaded.status, 200);
    const { presignedUrl } = await uploaded.json();
    const parsed = new URL(presignedUrl);
    assert.equal(parsed.protocol, 'http:');
    assert.equal(parsed.host, '127.0.0.1:9000');
    assert.match(parsed.pathname, /^\/itransfer-local\/transfers\/[^/]+\/notes\.txt$/);
    assert.match(parsed.searchParams.get('X-Amz-Credential'), /\/us-east-1\/s3\/aws4_request$/);
    const signature = parsed.searchParams.get('X-Amz-Signature');
    assert.equal(signature, expectedPresignSignature({
      url: presignedUrl,
      secret: valid.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      region: 'us-east-1',
      host: '127.0.0.1:9000',
    }));
    assert.notEqual(signature, expectedPresignSignature({
      url: presignedUrl,
      secret: valid.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      region: 'us-east-1',
      host: 'local-account.r2.cloudflarestorage.com',
    }));

    const started = await dispatchLocalViteRequest({
      isolated: true,
      env: valid,
      request: post('initiate-upload', {
        fileName: 'notes.txt',
        fileSize: 20,
        contentType: 'text/plain',
        deleteToken,
      }),
    });
    assert.equal(started.status, 200);
    assert.equal(state.storage.length, 1);
    assert.equal(new URL(state.storage[0].href).host, '127.0.0.1:9000');
    assert.equal(state.storage[0].host, '127.0.0.1:9000');
    assert.match(new URL(state.storage[0].href).pathname, /^\/itransfer-local\/transfers\//);
    assert.equal(calls.some((href) => href.includes('.r2.cloudflarestorage.com')), false);
    assert.equal(calls.some((href) => href.includes('giyeepztahdbsejsozog.supabase.co')), false);
  });
}));

test('production configuration still signs the Cloudflare R2 host and keeps failing closed', () => exclusive(async () => {
  const env = {
    SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    SUPABASE_URL: 'https://example.supabase.co',
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'ak',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'sk',
    CLOUDFLARE_R2_BUCKET: 'itransfer-storage',
    RATE_LIMITER: {
      fetch: async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
    },
  };
  const state = restState();
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('giyeepztahdbsejsozog.supabase.co')) throw new Error(href);
    if (!href.startsWith('https://example.supabase.co/')) throw new Error(href);
    return localRest(href, options, state);
  };
  try {
    const opened = await handleR2Request({ request: post('open-transfer'), env });
    assert.equal(opened.status, 200);
    const { deleteToken } = await opened.json();
    const uploaded = await handleR2Request({
      request: post('get-put-url', {
        fileName: 'notes.txt',
        fileSize: 20,
        contentType: 'text/plain',
        deleteToken,
      }),
      env,
    });
    assert.equal(uploaded.status, 200);
    const { presignedUrl } = await uploaded.json();
    const parsed = new URL(presignedUrl);
    assert.equal(parsed.host, 'acct.r2.cloudflarestorage.com');
    assert.match(parsed.pathname, /^\/itransfer-storage\/transfers\//);
    assert.match(parsed.searchParams.get('X-Amz-Credential'), /\/auto\/s3\/aws4_request$/);
    assert.equal(parsed.searchParams.get('X-Amz-Signature'), expectedPresignSignature({
      url: presignedUrl,
      secret: 'sk',
      region: 'auto',
      host: 'acct.r2.cloudflarestorage.com',
    }));
  } finally {
    globalThis.fetch = original;
  }

  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    throw new Error('fetch should not run');
  };
  try {
    const blocked = await handleR2Request({
      request: post('open-transfer'),
      env: { ...env, RATE_LIMITER: undefined },
    });
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).code, 'RATE_LIMIT_UNAVAILABLE');
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = original;
  }
}));

test('isolated mode does not inherit a production Supabase URL from the process environment', () => exclusive(async () => {
  const previous = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = 'https://giyeepztahdbsejsozog.supabase.co';
  try {
    await withFetch(() => {
      throw new Error('fetch should not run');
    }, async (calls) => {
      const response = await handleR2Request({
        request: post('open-transfer'),
        env: { ITRANSFER_ISOLATED: '1', SUPABASE_SERVICE_ROLE_KEY: 'local-service-role' },
      });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, 'ISOLATED_CONFIG_INVALID');
      assert.equal(calls.length, 0);
    });
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous;
  }
}));

test('the isolated Supabase workdir has no repository migrations', () => {
  const root = new URL('../supabase/testing/local-stack/supabase/', import.meta.url);
  const config = readFileSync(new URL('config.toml', root), 'utf8');
  assert.match(config, /project_id = "itransfer-local-stack"/);
  assert.match(config, /port = 55421/);
  assert.match(config, /schema_paths = \[\]/);
  assert.match(config, /sql_paths = \[\]/);
  assert.doesNotMatch(config, /\.\.\/\.\.\/migrations|\.\.\/migrations/);
  const names = readdirSync(new URL('migrations/', root));
  assert.deepEqual(names.filter((name) => name.endsWith('.sql')), []);
  const fixture = readFileSync(new URL('../supabase/testing/itransfer-local.sql', import.meta.url), 'utf8');
  assert.match(fixture, /create table if not exists public\.transfers/);
});

test('claim hashes are real sha256 values', () => exclusive(async () => {
  const decision = assessViteApi({ isolated: true, env: valid });
  const state = restState();
  await withFetch((href, options) => localRest(href, options, state), async () => {
    const opened = await handleR2Request({ request: post('open-transfer'), env: decision.env });
    assert.equal(opened.status, 200);
    const body = await opened.json();
    assert.equal(state.claims[0].token_hash, await sha256Hex(body.claimToken));
  });
}));
