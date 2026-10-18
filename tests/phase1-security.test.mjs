import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest as sendEmail } from '../functions/api/send-email.js';
import { handleR2Request } from '../functions/lib/r2Engine.js';
import { sha256Hex } from '../functions/lib/transferSecurity.js';

const ENV = {
  SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  SUPABASE_URL: 'https://example.supabase.co',
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'ak',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'sk',
  CLOUDFLARE_R2_BUCKET: 'itransfer-storage',
  CLEANUP_SECRET: 'cleanup-test',
  RATE_LIMITER: {
    fetch: async () => new Response(JSON.stringify({ allowed: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  },
};

const USER_ID = '11111111-1111-1111-1111-111111111111';

function createState() {
  return {
    claims: [],
    requests: [],
    transfers: [],
    sizes: new Map(),
    r2Deletes: [],
    r2Writes: [],
    nextId: 1,
  };
}

function matchRows(rows, url) {
  return rows.filter((row) => [...url.searchParams.entries()].every(([key, value]) => {
    if (key === 'select' || key === 'limit' || key === 'order') return true;
    if (key === 'or') {
      const inner = value.replace(/^\(/, '').replace(/\)$/, '');
      return inner.split(',').some((part) => {
        const [col, op, expected] = part.split('.');
        if (op === 'is') return row[col] == null;
        if (op === 'eq') return String(row[col]) === expected;
        return false;
      });
    }
    const dot = value.indexOf('.');
    const op = value.slice(0, dot);
    const expected = decodeURIComponent(value.slice(dot + 1));
    if (op === 'eq') return String(row[key]) === expected;
    if (op === 'lt') {
      const left = new Date(row[key]).getTime();
      const right = new Date(expected).getTime();
      return Number.isFinite(left) && Number.isFinite(right) && left < right;
    }
    if (op === 'in') {
      const list = expected.replace(/^\(/, '').replace(/\)$/, '').split(',').filter(Boolean);
      return list.includes(String(row[key]));
    }
    if (op === 'is') return expected === 'null' ? row[key] == null : false;
    return false;
  }));
}

function applyRestQuery(rows, url) {
  let matched = matchRows(rows, url);
  const order = url.searchParams.get('order');
  if (order) {
    const parts = order.split(',').map((part) => {
      const [col, dir] = part.split('.');
      return { col, desc: dir === 'desc' };
    });
    matched = [...matched].sort((a, b) => {
      for (const { col, desc } of parts) {
        const left = a[col] ?? '';
        const right = b[col] ?? '';
        if (left < right) return desc ? 1 : -1;
        if (left > right) return desc ? -1 : 1;
      }
      return 0;
    });
  }
  if (url.searchParams.has('limit')) {
    const limit = Number(url.searchParams.get('limit'));
    if (Number.isFinite(limit) && limit >= 0) matched = matched.slice(0, limit);
  }
  return matched;
}

function installFetch(state, { restStatus = 200 } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    const method = options.method || 'GET';
    if (href.includes('/auth/v1/user')) {
      const token = options.headers?.Authorization || '';
      if (token.endsWith('admin-jwt')) {
        return new Response(JSON.stringify({ id: USER_ID, email: 'iprudhvichowdary@gmail.com' }), { status: 200 });
      }
      if (token.endsWith('user-jwt')) {
        return new Response(JSON.stringify({ id: USER_ID, email: 'person@example.com' }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'bad' }), { status: 401 });
    }
    if (href.includes('.r2.cloudflarestorage.com')) {
      const parsed = new URL(href);
      const key = decodeURIComponent(parsed.pathname.replace(/^\/itransfer-storage\//, ''));
      if (method === 'HEAD') {
        if (!state.sizes.has(key)) return new Response(null, { status: 404 });
        return new Response(null, { status: 200, headers: { 'content-length': String(state.sizes.get(key)) } });
      }
      if (method === 'DELETE') {
        state.r2Deletes.push(key);
        if (state.failDelete || state.failDeleteKeys?.has(key)) return new Response('no', { status: 500 });
        const forced = state.deleteStatuses?.get(key);
        if (forced) return new Response(null, { status: forced });
        state.sizes.delete(key);
        return new Response(null, { status: 204 });
      }
      if (method === 'POST' && parsed.searchParams.has('uploads')) {
        state.r2Writes.push({ op: 'initiate', key });
        return new Response('<UploadId>upload-1</UploadId>', { status: 200 });
      }
      if (method === 'POST') {
        state.r2Writes.push({ op: 'complete', key });
        return new Response('<ETag>"abc"</ETag>', { status: 200 });
      }
      if (method === 'GET') {
        if (parsed.searchParams.get('list-type') === '2') {
          if (state.listStatus) return new Response('no', { status: state.listStatus });
          const pages = state.listPages || [[]];
          const token = parsed.searchParams.get('continuation-token');
          const pageIndex = token ? Number(token) : 0;
          state.listCalls = (state.listCalls || 0) + 1;
          const keys = pages[pageIndex] || [];
          const truncated = pageIndex + 1 < pages.length;
          const xml = `<ListBucketResult><IsTruncated>${truncated ? 'true' : 'false'}</IsTruncated>${truncated ? `<NextContinuationToken>${pageIndex + 1}</NextContinuationToken>` : ''}${keys.map((item) => `<Key>${item}</Key>`).join('')}</ListBucketResult>`;
          return new Response(xml, { status: 200 });
        }
        return new Response('<ListBucketResult></ListBucketResult>', { status: 200 });
      }
      if (method === 'PUT') {
        state.r2Writes.push({ op: 'put', key });
        return new Response('', { status: 200 });
      }
      return new Response('unexpected r2', { status: 500 });
    }
    if (href.includes('/rest/v1/')) {
      if (restStatus !== 200) return new Response(JSON.stringify({ message: 'db down' }), { status: restStatus });
      const auth = options.headers?.Authorization || '';
      if (!auth.includes('service-test')) return new Response(JSON.stringify({ message: 'no' }), { status: 401 });
      const parsed = new URL(href);
      const tableName = parsed.pathname.split('/').pop();
      const table = tableName === 'transfer_claims'
        ? state.claims
        : tableName === 'file_requests'
          ? state.requests
          : state.transfers;
      const body = options.body ? JSON.parse(options.body) : null;
      if (method === 'GET') {
        return new Response(JSON.stringify(applyRestQuery(table, parsed)), { status: 200 });
      }
      if (method === 'POST') {
        const incoming = Array.isArray(body) ? body : [body];
        for (const row of incoming) {
          if (tableName === 'transfer_claims') {
            const duplicate = state.claims.some((item) => item.token_hash === row.token_hash || (item.share_id === row.share_id && item.purpose === row.purpose));
            if (duplicate) return new Response(JSON.stringify({ code: '23505', message: 'duplicate' }), { status: 409 });
          }
        }
        const inserted = incoming.map((row) => ({ ...row, id: `id-${state.nextId++}` }));
        table.push(...inserted);
        return new Response(JSON.stringify(inserted), { status: 201 });
      }
      if (method === 'PATCH') {
        const matched = matchRows(table, parsed);
        for (const row of matched) Object.assign(row, body);
        return new Response(JSON.stringify(matched), { status: 200 });
      }
    }
    return new Response('unmocked', { status: 500 });
  };
  return () => { globalThis.fetch = original; };
}

function scriptedLimiter(decide) {
  const calls = [];
  return {
    calls,
    async fetch(_url, init) {
      const body = JSON.parse(init.body);
      calls.push(body);
      const decision = typeof decide === 'function' ? await decide(body) : decide;
      if (decision === 'throw') throw new Error('limiter down');
      if (decision === 'malformed') return new Response('not-json', { status: 200 });
      if (decision === 'bad-shape') return new Response(JSON.stringify({ allowed: 'yes' }), { status: 200 });
      if (decision === 'status') return new Response(JSON.stringify({ allowed: true }), { status: 503 });
      if (decision === 'block') return new Response(JSON.stringify({ allowed: false }), { status: 200 });
      return new Response(JSON.stringify({ allowed: true }), { status: 200 });
    },
  };
}

function limitedEnv(decide) {
  return { ...ENV, RATE_LIMITER: scriptedLimiter(decide) };
}

async function call(action, { method = 'POST', body, headers = {}, env = ENV, search = '' } = {}) {
  const request = new Request(`https://itransfer.iprudhvi.in/api/r2?action=${action}${search}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const response = await handleR2Request({ request, env });
  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
}

test('admin cleanup, delete, and cors are rejected without the cleanup secret', async () => {
  const state = createState();
  state.sizes.set('transfers/old-file', 10);
  const restore = installFetch(state);
  try {
    const cleanup = await call('cleanup', { method: 'GET' });
    const remove = await call('delete-object', { body: { s3Key: 'transfers/old-file' } });
    const cors = await call('ensure-cors');
    assert.equal(cleanup.status, 401);
    assert.equal(remove.status, 401);
    assert.equal(cors.status, 401);
    assert.equal(state.r2Deletes.length, 0);
    assert.equal(state.r2Writes.length, 0);
  } finally {
    restore();
  }
});

test('a missing service role rejects new uploads and download signing', async () => {
  const state = createState();
  const restore = installFetch(state);
  const env = { ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' };
  try {
    const opened = await call('open-transfer', { body: { shareId: 'guest-ok1' }, env });
    const download = await call('download-url', { method: 'GET', search: '&shareId=guest-ok1&fileId=row-existing', env });
    assert.equal(opened.status, 503);
    assert.equal(opened.data.code, 'NO_SERVICE_ROLE');
    assert.equal(download.status, 503);
    assert.equal(download.data.downloadUrl, undefined);
  } finally {
    restore();
  }
});

test('guest upload ignores a client pro plan and keeps claim and delete tokens separate', async () => {
  const state = createState();
  const restore = installFetch(state);
  try {
    const opened = await call('open-transfer', {
      body: { shareId: 'brand-pack-ab12', expiryHours: 720, userPlan: 'pro' },
    });
    assert.equal(opened.status, 200);
    assert.notEqual(opened.data.claimToken, opened.data.deleteToken);
    assert.equal(state.claims.length, 2);
    assert.equal(state.claims.some((row) => row.token_hash === opened.data.claimToken), false);
    assert.equal(state.claims.some((row) => row.token_hash === opened.data.deleteToken), false);
    assert.equal(state.claims.find((row) => row.purpose === 'claim').purpose, 'claim');
    assert.equal(state.claims.find((row) => row.purpose === 'delete').purpose, 'delete');
    const expiresIn = new Date(opened.data.expiresAt).getTime() - Date.now();
    assert.ok(expiresIn <= 168 * 60 * 60 * 1000);
    assert.ok(expiresIn > 167 * 60 * 60 * 1000);

    const tooBig = await call('get-put-url', {
      body: {
        fileName: 'big.bin',
        fileSize: 6_000_000_001,
        deleteToken: opened.data.deleteToken,
        userPlan: 'pro',
      },
    });
    assert.equal(tooBig.status, 403);
    assert.equal(tooBig.data.code, 'TRANSFER_TOO_LARGE');
    assert.equal(tooBig.data.presignedUrl, undefined);

    const put = await call('get-put-url', {
      body: { fileName: 'notes.txt', fileSize: 12, deleteToken: opened.data.deleteToken },
    });
    assert.equal(put.status, 200);
    assert.match(put.data.presignedUrl, /^https:\/\//);
    assert.equal(put.data.claimToken, undefined);
    assert.equal(state.transfers[0].status, 'pending');
    assert.equal(state.transfers[0].user_id, null);
    state.sizes.set(put.data.s3Key, 12);
    const writesBeforeFinalize = state.r2Writes.length;
    const finalized = await call('finalize-upload', { body: { s3Key: put.data.s3Key, deleteToken: opened.data.deleteToken } });
    assert.equal(finalized.status, 200);
    assert.equal(state.transfers[0].status, 'active');
    assert.equal(state.r2Writes.filter((item) => item.op === 'put').length, writesBeforeFinalize);

    const claimAsDelete = await call('delete-own', {
      body: { token: opened.data.claimToken },
    });
    assert.equal(claimAsDelete.status, 401);
    assert.equal(state.transfers[0].status, 'active');

    const shareOnly = await call('claim', {
      body: { shareId: 'brand-pack-ab12', email: 'person@example.com' },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(shareOnly.status, 401);
    assert.equal(state.transfers[0].user_id, null);

    const claimed = await call('claim', {
      body: { token: opened.data.claimToken },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(claimed.status, 200);
    assert.equal(state.transfers[0].user_id, USER_ID);
    assert.equal(state.transfers[0].file_path, put.data.s3Key);
    assert.ok(state.claims.find((row) => row.purpose === 'claim').used_at);
    assert.equal(state.claims.find((row) => row.purpose === 'delete').used_at, undefined);
    const r2AfterClaim = state.r2Writes.length + state.r2Deletes.length;
    assert.equal(r2AfterClaim, writesBeforeFinalize);

    const replay = await call('claim', {
      body: { token: opened.data.claimToken },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(replay.status, 401);
  } finally {
    restore();
  }
});

test('download signing fails closed and does not accept the stored hash as the password', async () => {
  const state = createState();
  const passwordHash = await sha256Hex('correct');
  state.transfers.push({
    id: 'row-1',
    share_id: 'live-link1',
    file_path: 'transfers/100-live/file.txt',
    file_size: 4,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    status: 'active',
    password_hash: passwordHash,
    user_id: null,
  });
  state.transfers.push({
    id: 'row-2',
    share_id: 'old-link1',
    file_path: 'transfers/100-old/file.txt',
    file_size: 4,
    expires_at: new Date(Date.now() - 1000).toISOString(),
    status: 'active',
    password_hash: null,
    user_id: null,
  });
  const restore = installFetch(state);
  try {
    const keyOnly = await call('download-url', { method: 'GET', search: '&s3Key=transfers/100-live/file.txt' });
    assert.equal(keyOnly.status, 400);
    assert.equal(keyOnly.data.downloadUrl, undefined);

    const missing = await call('download-url', { method: 'GET', search: '&shareId=missing-link&fileId=missing-row' });
    assert.equal(missing.status, 404);
    assert.equal(missing.data.downloadUrl, undefined);

    const expired = await call('download-url', { method: 'GET', search: '&shareId=old-link1&fileId=row-2' });
    assert.equal(expired.status, 410);

    const hashAsPassword = await call('download-url', {
      method: 'GET',
      search: '&shareId=live-link1&fileId=row-1',
      headers: { 'x-transfer-password': passwordHash },
    });
    assert.equal(hashAsPassword.status, 401);

    const spoofed = await call('verify-password', {
      body: { shareId: 'live-link1', inputPassword: passwordHash, expectedPasswordHash: passwordHash },
    });
    assert.equal(spoofed.status, 401);

    const allowed = await call('download-url', {
      method: 'GET',
      search: '&shareId=live-link1&fileId=row-1&s3Key=transfers/evil/other.bin',
      headers: { 'x-transfer-password': 'correct' },
    });
    assert.equal(allowed.status, 200);
    assert.match(allowed.data.downloadUrl, /transfers\/100-live\/file\.txt/);
    assert.equal(allowed.data.downloadUrl.includes('transfers/evil/other.bin'), false);
    assert.equal(allowed.data.password_hash, undefined);
    assert.equal(allowed.data.s3Key, undefined);
  } finally {
    restore();
  }
});

test('a failed object delete does not expire the transfer or consume the delete token', async () => {
  const state = createState();
  state.failDelete = true;
  const restore = installFetch(state);
  try {
    const opened = await call('open-transfer', { body: { shareId: 'keep-file1' } });
    const put = await call('get-put-url', {
      body: { fileName: 'keep.txt', fileSize: 8, deleteToken: opened.data.deleteToken },
    });
    state.sizes.set(put.data.s3Key, 8);
    await call('finalize-upload', { body: { s3Key: put.data.s3Key, deleteToken: opened.data.deleteToken } });
    const removed = await call('delete-own', { body: { token: opened.data.deleteToken } });
    assert.equal(removed.status, 502);
    assert.equal(state.transfers[0].status, 'active');
    assert.equal(state.claims.find((row) => row.purpose === 'delete').used_at, undefined);
  } finally {
    restore();
  }
});

test('database lookup failure does not sign a download', async () => {
  const state = createState();
  const restore = installFetch(state, { restStatus: 500 });
  try {
    const download = await call('download-url', { method: 'GET', search: '&shareId=live-link1&fileId=row-1' });
    assert.equal(download.status, 503);
    assert.equal(download.data.downloadUrl, undefined);
  } finally {
    restore();
  }
});

test('public share metadata hides secrets and a share id cannot rename or claim ownership', async () => {
  const state = createState();
  const passwordHash = await sha256Hex('correct');
  state.transfers.push({
    id: 'row-live01',
    share_id: 'live-link1',
    file_name: 'file.txt',
    file_size: 4,
    file_path: 'transfers/100-live/file.txt',
    content_type: 'text/plain',
    subject: 'Notes',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    status: 'active',
    password_hash: passwordHash,
    user_id: '22222222-2222-2222-2222-222222222222',
    download_count: 0,
    max_downloads: 0,
  });
  const restore = installFetch(state);
  try {
    const meta = await call('share-meta', { method: 'GET', search: '&shareId=live-link1' });
    assert.equal(meta.status, 200);
    const body = JSON.stringify(meta.data);
    assert.equal(meta.data.passwordRequired, true);
    assert.equal(meta.data.files[0].fileName, 'file.txt');
    assert.equal(body.includes('password_hash'), false);
    assert.equal(body.includes(passwordHash), false);
    assert.equal(body.includes('file_path'), false);
    assert.equal(body.includes('transfers/100-live/file.txt'), false);
    assert.equal(body.includes('token_hash'), false);
    assert.equal(meta.data.user_id, undefined);

    const renamed = await call('rename-transfer', {
      body: { shareId: 'live-link1', subject: 'Taken', userId: USER_ID },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(renamed.status, 403);
    assert.equal(state.transfers[0].subject, 'Notes');
    assert.equal(state.transfers[0].user_id, '22222222-2222-2222-2222-222222222222');

    const summary = await call('admin-summary', {
      method: 'GET',
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(summary.status, 403);
    assert.equal(summary.data.uploaders, undefined);
  } finally {
    restore();
  }
});

test('file requests cannot be read or written around the API', async () => {
  const state = createState();
  const restore = installFetch(state);
  try {
    const anon = await call('create-request', { body: { title: 'Brief' } });
    assert.equal(anon.status, 401);

    const created = await call('create-request', {
      body: { title: 'Client files', instructions: 'PDF only' },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(created.status, 200);
    assert.match(created.data.requestId, /^req-/);
    const createdBody = JSON.stringify(created.data);
    assert.equal(createdBody.includes('owner_email'), false);
    assert.equal(createdBody.includes(USER_ID), false);

    const meta = await call('request-meta', {
      method: 'GET',
      search: `&requestId=${created.data.requestId}`,
    });
    assert.equal(meta.status, 200);
    assert.equal(meta.data.title, 'Client files');
    assert.equal(meta.data.owner_user_id, undefined);
    assert.equal(JSON.stringify(meta.data).includes('owner_email'), false);

    const missing = await call('request-meta', { method: 'GET', search: '&requestId=missing-request' });
    assert.equal(missing.status, 404);

    state.requests.push({
      request_id: 'other-request',
      owner_user_id: '22222222-2222-2222-2222-222222222222',
      title: 'Other',
      status: 'active',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    const forbidden = await call('close-request', {
      body: { requestId: 'other-request' },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(state.requests.find((row) => row.request_id === 'other-request').status, 'active');

    const opened = await call('open-transfer', { body: { shareId: 'reqshare1', expiryHours: 24 } });
    const rejected = await call('get-put-url', {
      body: {
        fileName: 'notes.txt',
        fileSize: 12,
        deleteToken: opened.data.deleteToken,
        requestId: 'missing-request',
      },
    });
    assert.equal(rejected.status, 404);
    assert.equal(rejected.data.presignedUrl, undefined);
    assert.equal(state.transfers.length, 0);

    const closed = await call('close-request', {
      body: { requestId: created.data.requestId },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(closed.status, 200);
    const after = await call('request-meta', {
      method: 'GET',
      search: `&requestId=${created.data.requestId}`,
    });
    assert.equal(after.status, 410);

    const mine = await call('my-requests', {
      method: 'GET',
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(mine.status, 200);
    assert.equal(mine.data.requests.some((row) => row.requestId === 'other-request'), false);
    assert.equal(mine.data.requests.some((row) => row.requestId === created.data.requestId), true);
  } finally {
    restore();
  }
});

const CLEANUP_HEADERS = { 'x-cleanup-secret': 'cleanup-test' };

function expiredTransfer(id, shareId, filePath) {
  return {
    id,
    share_id: shareId,
    file_path: filePath,
    file_name: 'file.txt',
    file_size: 4,
    expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    status: 'active',
  };
}

test('cleanup expires only the object that was deleted', async () => {
  const state = createState();
  const row = expiredTransfer('row-clean-1', 'share-clean', 'transfers/100-clean/file.txt');
  const live = {
    ...expiredTransfer('row-live', 'share-live', 'transfers/100-live/file.txt'),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  state.transfers.push(row, live);
  state.sizes.set(row.file_path, 4);
  state.sizes.set(live.file_path, 4);
  const restore = installFetch(state);
  try {
    const result = await call('cleanup', { method: 'GET', headers: CLEANUP_HEADERS });
    assert.equal(result.status, 200);
    assert.equal(result.data.purgedCount, 1);
    assert.equal(state.transfers.find((item) => item.id === row.id).status, 'expired');
    assert.equal(state.transfers.find((item) => item.id === live.id).status, 'active');
    assert.equal(state.sizes.has(row.file_path), false);
    assert.equal(state.sizes.has(live.file_path), true);
  } finally {
    restore();
  }
});

test('a failed cleanup deletion stays pending and can be retried', async () => {
  const state = createState();
  const row = expiredTransfer('row-retry', 'share-retry', 'transfers/100-retry/file.txt');
  state.transfers.push(row);
  state.sizes.set(row.file_path, 4);
  state.failDeleteKeys = new Set([row.file_path]);
  const restore = installFetch(state);
  try {
    const failed = await call('cleanup', { method: 'GET', headers: CLEANUP_HEADERS });
    assert.equal(failed.status, 200);
    assert.equal(failed.data.pendingCount, 1);
    assert.equal(failed.data.purgedCount, 0);
    assert.equal(state.transfers[0].status, 'pending_delete');
    assert.equal(state.sizes.has(row.file_path), true);

    state.failDeleteKeys = new Set();
    const retried = await call('cleanup', { method: 'GET', headers: CLEANUP_HEADERS });
    assert.equal(retried.status, 200);
    assert.equal(retried.data.purgedCount, 1);
    assert.equal(state.transfers[0].status, 'expired');
    assert.equal(state.sizes.has(row.file_path), false);
  } finally {
    restore();
  }
});

test('cleanup of one file does not expire the rest of its transfer', async () => {
  const state = createState();
  const kept = expiredTransfer('row-kept', 'share-multi', 'transfers/100-kept/a.txt');
  const gone = expiredTransfer('row-gone', 'share-multi', 'transfers/100-gone/b.txt');
  state.transfers.push(kept, gone);
  state.sizes.set(kept.file_path, 4);
  state.sizes.set(gone.file_path, 4);
  state.failDeleteKeys = new Set([kept.file_path]);
  const restore = installFetch(state);
  try {
    const result = await call('cleanup', { method: 'GET', headers: CLEANUP_HEADERS });
    assert.equal(result.status, 200);
    assert.equal(state.transfers.find((item) => item.id === kept.id).status, 'pending_delete');
    assert.equal(state.transfers.find((item) => item.id === gone.id).status, 'expired');
    assert.equal(state.sizes.has(kept.file_path), true);
    assert.equal(state.sizes.has(gone.file_path), false);
  } finally {
    restore();
  }
});

test('cleanup moves past the first 200 rows and bounds object listing', async () => {
  const state = createState();
  for (let index = 1; index <= 201; index += 1) {
    const id = `c${String(index).padStart(3, '0')}`;
    const row = expiredTransfer(id, `share-${id}`, `transfers/100-${id}/file.txt`);
    state.transfers.push(row);
    state.sizes.set(row.file_path, 4);
  }
  const oldStamp = Date.now() - (91 * 24 * 60 * 60 * 1000);
  const youngKey = `transfers/${Date.now()}-young/file.txt`;
  const protectedKey = `transfers/${oldStamp}-keep/file.txt`;
  const orphanKey = `transfers/${oldStamp}-orphan/file.txt`;
  state.transfers.push({
    id: 'row-protected',
    share_id: 'share-protected',
    file_path: protectedKey,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: 'active',
  });
  state.sizes.set(protectedKey, 4);
  state.sizes.set(orphanKey, 4);
  state.listPages = [
    [youngKey, protectedKey, orphanKey],
    ['transfers/not-a-stamp/file.txt'],
    [],
    [],
    [],
    ['transfers/should-not-list/file.txt'],
  ];
  const restore = installFetch(state);
  try {
    const first = await call('cleanup', { method: 'GET', headers: CLEANUP_HEADERS });
    assert.equal(first.status, 200);
    assert.equal(state.transfers.filter((item) => item.status === 'expired').length, 200);
    assert.equal(state.transfers.find((item) => item.id === 'c201').status, 'active');
    assert.equal(state.r2Deletes.includes(youngKey), false);
    assert.equal(state.sizes.has(protectedKey), true);
    assert.equal(state.sizes.has(orphanKey), false);
    assert.equal(state.listCalls, 5);

    const second = await call('cleanup', { method: 'GET', headers: CLEANUP_HEADERS });
    assert.equal(second.status, 200);
    assert.equal(state.transfers.find((item) => item.id === 'c201').status, 'expired');
  } finally {
    restore();
  }
});

test('cleanup reports a database failure instead of success', async () => {
  const state = createState();
  const row = expiredTransfer('row-db', 'share-db', 'transfers/100-db/file.txt');
  state.transfers.push(row);
  state.sizes.set(row.file_path, 4);
  const restore = installFetch(state, { restStatus: 500 });
  try {
    const result = await call('cleanup', { method: 'GET', headers: CLEANUP_HEADERS });
    assert.equal(result.status, 503);
    assert.equal(result.data.message, undefined);
    assert.equal(state.r2Deletes.length, 0);
    assert.equal(state.transfers[0].status, 'active');
  } finally {
    restore();
  }
});

test('get-part-urls accepts five part numbers and rejects six before signing', async () => {
  const state = createState();
  const restore = installFetch(state);
  const headers = { 'cf-connecting-ip': '198.51.100.40' };
  try {
    const opened = await call('open-transfer', { headers, body: { shareId: 'parts-ok1' } });
    assert.equal(opened.status, 200);
    const started = await call('initiate-upload', {
      headers,
      body: { fileName: 'clip.bin', fileSize: 80, deleteToken: opened.data.deleteToken },
    });
    assert.equal(started.status, 200);
    assert.equal(state.transfers[0].status, 'pending');

    const five = await call('get-part-urls', {
      headers,
      body: {
        s3Key: started.data.s3Key,
        uploadId: started.data.uploadId,
        deleteToken: opened.data.deleteToken,
        partNumbers: [1, 2, 3, 4, 5],
      },
    });
    assert.equal(five.status, 200);
    assert.equal(five.data.parts.length, 5);
    assert.deepEqual(five.data.parts.map((part) => part.partNumber), [1, 2, 3, 4, 5]);
    assert.ok(five.data.parts.every((part) => String(part.presignedUrl).includes('X-Amz-Signature')));

    const six = await call('get-part-urls', {
      headers,
      body: {
        s3Key: started.data.s3Key,
        uploadId: started.data.uploadId,
        deleteToken: opened.data.deleteToken,
        partNumbers: [1, 2, 3, 4, 5, 6],
      },
    });
    assert.equal(six.status, 400);
    assert.equal(six.data.code, 'PART_BATCH_TOO_LARGE');
    assert.equal(six.data.parts, undefined);
    assert.equal(six.data.presignedUrl, undefined);
    assert.equal(JSON.stringify(six.data).includes('X-Amz-Signature'), false);

    const notAnArray = await call('get-part-urls', {
      headers,
      body: {
        s3Key: started.data.s3Key,
        uploadId: started.data.uploadId,
        deleteToken: opened.data.deleteToken,
        partNumbers: 1,
      },
    });
    assert.equal(notAnArray.status, 400);
    assert.equal(notAnArray.data.code, 'PART_NUMBERS_INVALID');
    assert.equal(notAnArray.data.presignedUrl, undefined);
    assert.equal(state.transfers[0].status, 'pending');
  } finally {
    restore();
  }
});

test('failed passwords share one counter across verify and download', async () => {
  const state = createState();
  const passwordA = await sha256Hex('correct-a');
  const passwordB = await sha256Hex('correct-b');
  state.transfers.push({
    id: 'row-a',
    share_id: 'pw-share-a',
    file_name: 'a.txt',
    file_path: 'transfers/100-a/a.txt',
    file_size: 4,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    status: 'active',
    password_hash: passwordA,
    max_downloads: 0,
    download_count: 0,
  });
  state.transfers.push({
    id: 'row-b',
    share_id: 'pw-share-b',
    file_name: 'b.txt',
    file_path: 'transfers/100-b/b.txt',
    file_size: 4,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    status: 'active',
    password_hash: passwordB,
    max_downloads: 0,
    download_count: 0,
  });
  const restore = installFetch(state);
  const headers = { 'cf-connecting-ip': '198.51.100.41' };
  const downloadA = (password) => call('download-url', {
    method: 'GET',
    search: '&shareId=pw-share-a&fileId=row-a',
    headers: password ? { ...headers, 'x-transfer-password': password } : headers,
  });
  try {
    for (let i = 0; i < 3; i += 1) {
      const failed = await call('verify-password', {
        headers,
        body: { shareId: 'pw-share-a', inputPassword: 'wrong' },
      });
      assert.equal(failed.status, 401);
      assert.equal(failed.data.code, 'PASSWORD_INCORRECT');
    }

    const earlySuccess = await call('verify-password', {
      headers,
      body: { shareId: 'pw-share-a', inputPassword: 'correct-a' },
    });
    assert.equal(earlySuccess.status, 200);
    assert.equal(earlySuccess.data.success, true);

    for (let i = 0; i < 3; i += 1) {
      const failed = await downloadA('wrong');
      assert.equal(failed.status, 401);
      assert.equal(failed.data.code, 'PASSWORD_INCORRECT');
      assert.equal(failed.data.downloadUrl, undefined);
    }

    const missing = await downloadA('');
    assert.equal(missing.status, 401);
    assert.equal(missing.data.code, 'PASSWORD_REQUIRED');
    assert.equal(missing.data.downloadUrl, undefined);

    const eighth = await downloadA('still-wrong');
    assert.equal(eighth.status, 401);
    assert.equal(eighth.data.downloadUrl, undefined);

    const lockedDownload = await downloadA('correct-a');
    assert.equal(lockedDownload.status, 429);
    assert.equal(lockedDownload.data.code, 'PASSWORD_RATE_LIMIT');
    assert.equal(lockedDownload.data.downloadUrl, undefined);
    assert.ok(Number(lockedDownload.headers.get('retry-after')) >= 1);

    const lockedVerify = await call('verify-password', {
      headers,
      body: { shareId: 'pw-share-a', inputPassword: 'correct-a' },
    });
    assert.equal(lockedVerify.status, 429);
    assert.equal(lockedVerify.data.code, 'PASSWORD_RATE_LIMIT');
    assert.ok(Number(lockedVerify.headers.get('retry-after')) >= 1);

    const otherFailure = await call('verify-password', {
      headers,
      body: { shareId: 'pw-share-b', inputPassword: 'wrong' },
    });
    assert.equal(otherFailure.status, 401);
    assert.equal(otherFailure.data.code, 'PASSWORD_INCORRECT');

    const otherSuccess = await call('download-url', {
      method: 'GET',
      search: '&shareId=pw-share-b&fileId=row-b',
      headers: { ...headers, 'x-transfer-password': 'correct-b' },
    });
    assert.equal(otherSuccess.status, 200);
    assert.match(otherSuccess.data.downloadUrl, /transfers\/100-b\/b\.txt/);
  } finally {
    restore();
  }
});

test('shared limiter keys use the Cloudflare client IP and block protected writes', async () => {
  const state = createState();
  const restore = installFetch(state);
  const allowed = scriptedLimiter('allow');
  try {
    const opened = await call('open-transfer', {
      headers: { 'cf-connecting-ip': '198.51.100.8', 'x-forwarded-for': '203.0.113.9' },
      body: { shareId: 'limit-open1' },
      env: { ...ENV, RATE_LIMITER: allowed },
    });
    assert.equal(opened.status, 200);
    assert.deepEqual(allowed.calls[0], { bucket: 'upload', key: '198.51.100.8' });
    assert.equal(state.claims.length, 2);

    const spoofed = scriptedLimiter('allow');
    const fallbackIp = await call('open-transfer', {
      headers: { 'x-forwarded-for': '203.0.113.9' },
      body: { shareId: 'limit-open2' },
      env: { ...ENV, RATE_LIMITER: spoofed },
    });
    assert.equal(fallbackIp.status, 200);
    assert.deepEqual(spoofed.calls[0], { bucket: 'upload', key: '0.0.0.0' });

    for (const decision of ['block', 'throw', 'malformed', 'bad-shape', 'status']) {
      const before = state.claims.length;
      const limiter = scriptedLimiter(decision);
      const rejected = await call('open-transfer', {
        headers: { 'cf-connecting-ip': '198.51.100.8' },
        body: { shareId: `limit-${decision}` },
        env: { ...ENV, RATE_LIMITER: limiter },
      });
      assert.equal(rejected.status, decision === 'block' ? 429 : 503);
      assert.equal(rejected.data.code, decision === 'block' ? 'RATE_LIMITED' : 'RATE_LIMIT_UNAVAILABLE');
      assert.equal(state.claims.length, before);
    }

    const put = await call('get-put-url', {
      headers: { 'cf-connecting-ip': '198.51.100.8' },
      body: { fileName: 'note.txt', fileSize: 8, deleteToken: opened.data.deleteToken },
      env: limitedEnv('block'),
    });
    assert.equal(put.status, 429);
    assert.equal(put.data.presignedUrl, undefined);
    assert.equal(state.transfers.length, 0);

    const started = await call('initiate-upload', {
      headers: { 'cf-connecting-ip': '198.51.100.8' },
      body: { fileName: 'clip.bin', fileSize: 80, deleteToken: opened.data.deleteToken },
      env: limitedEnv('throw'),
    });
    assert.equal(started.status, 503);
    assert.equal(state.transfers.length, 0);
    assert.equal(state.r2Writes.some((item) => item.op === 'initiate'), false);
  } finally {
    restore();
  }
});

test('part batches stay capped at five and finish when the limiter is down', async () => {
  const state = createState();
  const restore = installFetch(state);
  const headers = { 'cf-connecting-ip': '198.51.100.40' };
  try {
    const opened = await call('open-transfer', { headers, body: { shareId: 'parts-lim1' } });
    const started = await call('initiate-upload', {
      headers,
      body: { fileName: 'clip.bin', fileSize: 80, deleteToken: opened.data.deleteToken },
    });
    const body = {
      s3Key: started.data.s3Key,
      uploadId: started.data.uploadId,
      deleteToken: opened.data.deleteToken,
    };
    const allowed = scriptedLimiter('allow');
    const five = await call('get-part-urls', {
      headers,
      body: { ...body, partNumbers: [1, 2, 3, 4, 5] },
      env: { ...ENV, RATE_LIMITER: allowed },
    });
    assert.equal(five.status, 200);
    assert.equal(five.data.parts.length, 5);
    assert.deepEqual(allowed.calls, [{ bucket: 'parts', key: '198.51.100.40' }]);

    const six = await call('get-part-urls', {
      headers,
      body: { ...body, partNumbers: [1, 2, 3, 4, 5, 6] },
      env: { ...ENV, RATE_LIMITER: allowed },
    });
    assert.equal(six.status, 400);
    assert.equal(six.data.code, 'PART_BATCH_TOO_LARGE');
    assert.equal(JSON.stringify(six.data).includes('X-Amz-Signature'), false);
    assert.equal(allowed.calls.length, 1);

    const down = await call('get-part-urls', {
      headers,
      body: { ...body, partNumbers: [1, 2, 3, 4, 5] },
      env: limitedEnv('throw'),
    });
    assert.equal(down.status, 200);
    assert.equal(down.data.parts.length, 5);

    const blocked = await call('get-part-urls', {
      headers,
      body: { ...body, partNumbers: [1, 2, 3, 4, 5] },
      env: limitedEnv('block'),
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.data.presignedUrl, undefined);
    assert.equal(JSON.stringify(blocked.data).includes('X-Amz-Signature'), false);
  } finally {
    restore();
  }
});

test('download signing and password checks stay closed when the shared limiter fails', async () => {
  const state = createState();
  const passwordHash = await sha256Hex('correct-limit');
  state.transfers.push({
    id: 'row-limit',
    share_id: 'pw-bind-1',
    file_name: 'secret.txt',
    file_path: 'transfers/100-limit/secret.txt',
    file_size: 4,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    status: 'active',
    password_hash: passwordHash,
    max_downloads: 0,
    download_count: 0,
  });
  const restore = installFetch(state);
  const headers = { 'cf-connecting-ip': '198.51.100.41' };
  try {
    const blocked = await call('download-url', {
      method: 'GET',
      search: '&shareId=pw-bind-1&fileId=row-limit',
      headers: { ...headers, 'x-transfer-password': 'correct-limit' },
      env: limitedEnv('block'),
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.data.downloadUrl, undefined);
    assert.equal(state.transfers[0].download_count, 0);

    const unavailable = await call('download-url', {
      method: 'GET',
      search: '&shareId=pw-bind-1&fileId=row-limit',
      headers: { ...headers, 'x-transfer-password': 'correct-limit' },
      env: limitedEnv('malformed'),
    });
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.data.downloadUrl, undefined);
    assert.equal(state.transfers[0].download_count, 0);

    const limiter = scriptedLimiter('allow');
    const wrong = await call('verify-password', {
      headers,
      body: { shareId: 'pw-bind-1', inputPassword: 'wrong' },
      env: { ...ENV, RATE_LIMITER: limiter },
    });
    assert.equal(wrong.status, 401);
    assert.equal(limiter.calls.length, 0);

    const signed = await call('download-url', {
      method: 'GET',
      search: '&shareId=pw-bind-1&fileId=row-limit',
      headers: { ...headers, 'x-transfer-password': 'correct-limit' },
      env: { ...ENV, RATE_LIMITER: limiter },
    });
    assert.equal(signed.status, 200);
    assert.match(signed.data.downloadUrl, /transfers\/100-limit\/secret\.txt/);
    assert.deepEqual(limiter.calls, [{ bucket: 'download', key: '198.51.100.41' }]);
    assert.equal(limiter.calls.some((call) => call.bucket === 'password'), false);
  } finally {
    restore();
  }
});

test('claim, delete, request, and metadata limits do not apply their side effects when blocked', async () => {
  const state = createState();
  const restore = installFetch(state);
  const headers = { 'cf-connecting-ip': '198.51.100.60' };
  try {
    const opened = await call('open-transfer', { headers, body: { shareId: 'side-lim1' } });
    const put = await call('get-put-url', {
      headers,
      body: { fileName: 'keep.txt', fileSize: 8, deleteToken: opened.data.deleteToken },
    });
    state.sizes.set(put.data.s3Key, 8);
    await call('finalize-upload', { headers, body: { s3Key: put.data.s3Key, deleteToken: opened.data.deleteToken } });

    const claim = await call('claim', {
      headers: { ...headers, authorization: 'Bearer user-jwt' },
      body: { token: opened.data.claimToken },
      env: limitedEnv('block'),
    });
    assert.equal(claim.status, 429);
    assert.equal(state.claims.find((row) => row.purpose === 'claim').used_at || null, null);

    const removed = await call('delete-own', {
      headers,
      body: { token: opened.data.deleteToken, shareId: 'side-lim1' },
      env: limitedEnv('status'),
    });
    assert.equal(removed.status, 503);
    assert.equal(state.transfers[0].status, 'active');
    assert.equal(state.r2Deletes.includes(put.data.s3Key), false);

    const requestLimiter = scriptedLimiter('allow');
    const created = await call('create-request', {
      headers: { ...headers, authorization: 'Bearer user-jwt', 'x-forwarded-for': '203.0.113.1' },
      body: { title: 'Photos' },
      env: { ...ENV, RATE_LIMITER: requestLimiter },
    });
    assert.equal(created.status, 200);
    assert.deepEqual(requestLimiter.calls[0], { bucket: 'request', key: USER_ID });

    const blockedRequest = await call('create-request', {
      headers: { ...headers, authorization: 'Bearer user-jwt' },
      body: { title: 'More' },
      env: limitedEnv('block'),
    });
    assert.equal(blockedRequest.status, 429);
    assert.equal(state.requests.length, 1);

    state.transfers.push({
      id: 'meta-row',
      share_id: 'meta-lim1',
      file_name: 'a.txt',
      file_path: 'transfers/100-meta/a.txt',
      file_size: 4,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'active',
      password_hash: null,
    });
    const meta = await call('share-meta', {
      method: 'GET',
      search: '&shareId=meta-lim1',
      headers,
      env: limitedEnv('block'),
    });
    assert.equal(meta.status, 429);
    assert.equal(meta.data.files, undefined);

    const portal = await call('request-meta', {
      method: 'GET',
      search: '&requestId=req-missing1',
      headers,
      env: limitedEnv('throw'),
    });
    assert.equal(portal.status, 503);
    assert.equal(portal.data.code, 'RATE_LIMIT_UNAVAILABLE');
  } finally {
    restore();
  }
});

test('send-email does not call Resend when the limiter blocks or is unavailable', async () => {
  const original = globalThis.fetch;
  const resendCalls = [];
  globalThis.fetch = async (url) => {
    resendCalls.push(String(url));
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  };
  const send = (decide, headers = { 'cf-connecting-ip': '198.51.100.70', 'x-forwarded-for': '1.2.3.4' }) => {
    const limiter = scriptedLimiter(decide);
    const request = new Request('https://itransfer.iprudhvi.in/api/send-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ shareId: 'mail-share', recipientEmails: 'a@example.com' }),
    });
    return sendEmail({
      request,
      env: { ...ENV, RESEND_API_KEY: 're_test', APP_URL: 'https://itransfer.iprudhvi.in', RATE_LIMITER: limiter },
    }).then(async (response) => ({ limiter, status: response.status, data: await response.json() }));
  };
  try {
    const blocked = await send('block');
    assert.equal(blocked.data.success, false);
    assert.equal(blocked.data.reason, 'rate_limited');
    assert.match(blocked.data.mailtoUrl, /^mailto:/);
    assert.deepEqual(blocked.limiter.calls[0], { bucket: 'email', key: '198.51.100.70' });
    assert.equal(resendCalls.length, 0);

    const unavailable = await send('throw');
    assert.equal(unavailable.data.reason, 'limiter_unavailable');
    assert.equal(resendCalls.length, 0);

    const spoofed = await send('allow', { 'x-forwarded-for': '203.0.113.8' });
    assert.deepEqual(spoofed.limiter.calls[0], { bucket: 'email', key: '0.0.0.0' });
    assert.equal(spoofed.data.success, true);
    assert.equal(spoofed.data.status, 'accepted');
    assert.equal(spoofed.data.delivery, 'unconfirmed');
    assert.equal(spoofed.data.provider, 'resend');
    assert.equal(resendCalls.length, 1);
    assert.match(resendCalls[0], /api\.resend\.com/);
  } finally {
    globalThis.fetch = original;
  }
});

test('cleanup is rejected when CLEANUP_SECRET is not configured', async () => {
  const state = createState();
  state.sizes.set('transfers/100-secret/file.txt', 4);
  const restore = installFetch(state);
  const env = { ...ENV, CLEANUP_SECRET: '' };
  try {
    const result = await call('cleanup', { method: 'GET', headers: CLEANUP_HEADERS, env });
    assert.equal(result.status, 503);
    assert.equal(result.data.code, 'CLEANUP_UNCONFIGURED');
    assert.equal(state.r2Deletes.length, 0);
  } finally {
    restore();
  }
});
