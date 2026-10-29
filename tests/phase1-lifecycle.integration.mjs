/**
 * Simulated handler integration for the guest transfer lifecycle.
 *
 * This is not a live Cloudflare or Supabase test. Nothing here contacts
 * production R2 or the tranferfiles database. handleR2Request runs in
 * process against stand-ins that speak a small slice of PostgREST and the
 * R2 SigV4 HTTP API.
 *
 * tests/phase1-security.test.mjs is the smaller mocked unit suite.
 * A real integration test would require a disposable R2 bucket and a
 * disposable database, which this file does not use.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleR2Request } from '../functions/lib/r2Engine.js';
import { claimDownloadSlot, releaseDownloadSlot, reserveInto, withShareLock } from '../functions/lib/transferReservation.js';
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
    transfers: [],
    objects: new Map(),
    parts: new Map(),
    r2Deletes: [],
    r2Writes: [],
    nextId: 1,
  };
}

function objectKey(url) {
  return decodeURIComponent(url.pathname.replace(/^\/itransfer-storage\//, ''));
}

function partKey(key, uploadId, partNumber) {
  return `${key}\n${uploadId}\n${partNumber}`;
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
    if (op === 'is') return expected === 'null' ? row[key] == null : false;
    return false;
  }));
}

function installFetch(state, { restStatus = 200 } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    const method = options.method || 'GET';
    if (href.includes('/auth/v1/user')) {
      const token = options.headers?.Authorization || '';
      if (token.endsWith('user-jwt')) {
        return new Response(JSON.stringify({ id: USER_ID, email: 'person@example.com' }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'bad' }), { status: 401 });
    }
    if (href.includes('.r2.cloudflarestorage.com')) {
      const parsed = new URL(href);
      const key = objectKey(parsed);
      if (method === 'HEAD') {
        const object = state.objects.get(key);
        if (!object) return new Response(null, { status: 404 });
        return new Response(null, { status: 200, headers: { 'content-length': String(object.size) } });
      }
      if (method === 'DELETE') {
        state.r2Deletes.push(key);
        if (state.failDelete) return new Response('no', { status: 500 });
        if (!parsed.searchParams.has('uploadId')) state.objects.delete(key);
        return new Response(null, { status: 204 });
      }
      if (method === 'POST' && parsed.searchParams.has('uploads')) {
        state.r2Writes.push({ op: 'initiate', key });
        return new Response('<UploadId>upload-1</UploadId>', { status: 200 });
      }
      if (method === 'POST' && parsed.searchParams.has('uploadId')) {
        let size = 0;
        for (const [partId, part] of state.parts) {
          if (partId.startsWith(`${key}\n${parsed.searchParams.get('uploadId')}\n`)) size += part.size;
        }
        state.objects.set(key, { size, body: 'assembled' });
        state.r2Writes.push({ op: 'complete', key, size });
        return new Response('<ETag>"abc"</ETag>', { status: 200 });
      }
      if (method === 'PUT') {
        const body = options.body == null ? '' : String(options.body);
        const size = Buffer.byteLength(body);
        const partNumber = parsed.searchParams.get('partNumber');
        if (partNumber) {
          state.parts.set(partKey(key, parsed.searchParams.get('uploadId'), partNumber), { size });
          state.r2Writes.push({ op: 'part', key, partNumber, size });
        } else {
          state.objects.set(key, { size, body });
          state.r2Writes.push({ op: 'put', key, size });
        }
        return new Response('', { status: 200, headers: { etag: `"part-${partNumber || 'object'}"` } });
      }
      if (method === 'GET') {
        const object = state.objects.get(key);
        if (!object) return new Response('missing', { status: 404 });
        return new Response(object.body || '', { status: 200 });
      }
      return new Response('unexpected r2', { status: 500 });
    }
    if (href.includes('/rest/v1/')) {
      if (restStatus !== 200) return new Response(JSON.stringify({ message: 'db down' }), { status: restStatus });
      const auth = options.headers?.Authorization || '';
      if (!auth.includes('service-test')) return new Response(JSON.stringify({ message: 'no' }), { status: 401 });
      const parsed = new URL(href);
      const tableName = parsed.pathname.split('/').pop();
      const table = tableName === 'transfer_claims' ? state.claims : state.transfers;
      const body = options.body ? JSON.parse(options.body) : null;
      if (tableName === 'reserve_transfer_file' && method === 'POST') {
        const payload = await withShareLock(state, 'platform', async () => (
          withShareLock(state, body?.p_share_id, async () => (
            reserveInto(state.transfers, body, `id-${state.nextId++}`)
          ))
        ));
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      if (tableName === 'claim_download_slot' && method === 'POST') {
        const payload = await withShareLock(state, body?.p_file_id, async () => (
          claimDownloadSlot(state.transfers, body)
        ));
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      if (tableName === 'release_download_slot' && method === 'POST') {
        const payload = await withShareLock(state, body?.p_file_id, async () => (
          releaseDownloadSlot(state.transfers, body)
        ));
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      if (method === 'GET') {
        return new Response(JSON.stringify(matchRows(table, parsed)), { status: 200 });
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

async function call(action, { method = 'POST', body, headers = {}, env = ENV, search = '', ip = '203.0.113.10' } = {}) {
  const request = new Request(`https://itransfer.iprudhvi.in/api/r2?action=${action}${search}`, {
    method,
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const response = await handleR2Request({ request, env });
  const data = await response.json();
  return { status: response.status, data };
}

test('simulated guest lifecycle: open, direct upload, password, claim, and delete', async () => {
  const state = createState();
  const restore = installFetch(state);
  const ip = '203.0.113.21';
  try {
    const opened = await call('open-transfer', {
      ip,
      body: { shareId: 'guest-life1', expiryHours: 24 },
    });
    assert.equal(opened.status, 200);
    assert.match(opened.data.claimToken, /^[A-Za-z0-9_-]{43}$/);
    assert.match(opened.data.deleteToken, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(opened.data.claimToken, opened.data.deleteToken);
    assert.equal(state.claims.length, 2);
    for (const row of state.claims) {
      assert.match(row.token_hash, /^[a-f0-9]{64}$/);
      assert.notEqual(row.token_hash, opened.data.claimToken);
      assert.notEqual(row.token_hash, opened.data.deleteToken);
    }
    assert.equal(state.claims.find((row) => row.purpose === 'claim').token_hash, await sha256Hex(opened.data.claimToken));
    assert.equal(state.claims.find((row) => row.purpose === 'delete').token_hash, await sha256Hex(opened.data.deleteToken));

    const password = 'correct-horse';
    const put = await call('get-put-url', {
      ip,
      body: {
        fileName: 'notes.txt',
        fileSize: 12,
        deleteToken: opened.data.deleteToken,
        password,
        userPlan: 'pro',
      },
    });
    assert.equal(put.status, 200);
    assert.equal(put.data.claimToken, undefined);
    assert.equal(put.data.deleteToken, undefined);
    assert.equal(state.transfers[0].status, 'pending');
    assert.equal(state.transfers[0].user_id, null);

    const uploaded = await fetch(put.data.presignedUrl, { method: 'PUT', body: 'x'.repeat(12) });
    assert.equal(uploaded.status, 200);
    assert.equal(state.objects.get(put.data.s3Key).size, 12);

    const pendingMeta = await call('share-meta', {
      ip,
      method: 'GET',
      search: '&shareId=guest-life1',
    });
    assert.equal(pendingMeta.status, 409);
    assert.equal(pendingMeta.data.files, undefined);

    const pendingDownload = await call('download-url', {
      ip,
      method: 'GET',
      search: `&shareId=guest-life1&fileId=${encodeURIComponent(state.transfers[0].id)}`,
    });
    assert.equal(pendingDownload.status, 409);
    assert.equal(pendingDownload.data.code, 'NOT_READY');
    assert.equal(pendingDownload.data.downloadUrl, undefined);

    const finalized = await call('finalize-upload', {
      ip,
      body: { s3Key: put.data.s3Key, deleteToken: opened.data.deleteToken },
    });
    assert.equal(finalized.status, 200);
    assert.equal(state.transfers[0].status, 'active');

    const wrong = await call('verify-password', {
      ip,
      body: { shareId: 'guest-life1', inputPassword: 'nope' },
    });
    assert.equal(wrong.status, 401);
    const hash = state.transfers[0].password_hash;
    const hashAsPassword = await call('verify-password', {
      ip,
      body: { shareId: 'guest-life1', inputPassword: hash, expectedPasswordHash: hash },
    });
    assert.equal(hashAsPassword.status, 401);
    const verified = await call('verify-password', {
      ip,
      body: { shareId: 'guest-life1', inputPassword: password },
    });
    assert.equal(verified.status, 200);

    const ready = await call('share-meta', { ip, method: 'GET', search: '&shareId=guest-life1' });
    assert.equal(ready.status, 200);
    assert.equal(ready.data.passwordRequired, true);
    const readyBody = JSON.stringify(ready.data);
    assert.equal(readyBody.includes('password_hash'), false);
    assert.equal(readyBody.includes(hash), false);
    assert.equal(readyBody.includes(put.data.s3Key), false);
    assert.equal(ready.data.files[0].id, state.transfers[0].id);

    const locked = await call('download-url', {
      ip,
      method: 'GET',
      search: `&shareId=guest-life1&fileId=${encodeURIComponent(state.transfers[0].id)}&s3Key=transfers/not-this/file.txt`,
      headers: { 'x-transfer-password': hash },
    });
    assert.equal(locked.status, 401);
    assert.equal(locked.data.downloadUrl, undefined);
    const openedDownload = await call('download-url', {
      ip,
      method: 'GET',
      search: `&shareId=guest-life1&fileId=${encodeURIComponent(state.transfers[0].id)}`,
      headers: { 'x-transfer-password': password },
    });
    assert.equal(openedDownload.status, 200);
    const downloaded = await fetch(openedDownload.data.downloadUrl);
    assert.equal(downloaded.status, 200);
    assert.equal(await downloaded.text(), 'x'.repeat(12));

    const writesBeforeClaim = state.r2Writes.length;
    const claimed = await call('claim', {
      ip,
      body: { token: opened.data.claimToken },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(claimed.status, 200);
    assert.equal(state.transfers[0].user_id, USER_ID);
    assert.equal(state.transfers[0].file_path, put.data.s3Key);
    assert.equal(state.r2Writes.length, writesBeforeClaim);
    assert.equal(state.r2Deletes.length, 0);
    const replay = await call('claim', {
      ip,
      body: { token: opened.data.claimToken },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(replay.status, 401);
    assert.equal(replay.data.code, 'TOKEN_USED');

    const removed = await call('delete-own', {
      ip,
      body: { token: opened.data.deleteToken, shareId: 'guest-life1' },
    });
    assert.equal(removed.status, 200);
    assert.equal(state.transfers[0].status, 'expired');
    assert.equal(state.objects.has(put.data.s3Key), false);
    assert.ok(state.claims.find((row) => row.purpose === 'delete').used_at);
    const afterDelete = await call('download-url', {
      ip,
      method: 'GET',
      search: `&shareId=guest-life1&fileId=${encodeURIComponent(state.transfers[0].id)}`,
      headers: { 'x-transfer-password': password },
    });
    assert.equal(afterDelete.status, 410);
    assert.equal(afterDelete.data.downloadUrl, undefined);
    const deleteReplay = await call('delete-own', {
      ip,
      body: { token: opened.data.deleteToken },
    });
    assert.equal(deleteReplay.status, 401);
    assert.equal(deleteReplay.data.code, 'TOKEN_USED');
  } finally {
    restore();
  }
});

test('simulated multipart upload accepts only a pending matching session', async () => {
  const state = createState();
  const restore = installFetch(state);
  const ip = '203.0.113.22';
  try {
    const opened = await call('open-transfer', { ip, body: { shareId: 'multi-life1' } });
    const started = await call('initiate-upload', {
      ip,
      body: { fileName: 'clip.bin', fileSize: 16, deleteToken: opened.data.deleteToken },
    });
    assert.equal(started.status, 200);
    assert.equal(started.data.uploadId, 'upload-1');
    assert.equal(state.transfers[0].status, 'pending');
    assert.equal(state.transfers[0].multipart_upload_id, 'upload-1');

    const parts = await call('get-part-urls', {
      ip,
      body: {
        s3Key: started.data.s3Key,
        uploadId: started.data.uploadId,
        deleteToken: opened.data.deleteToken,
        partNumbers: [1, 2],
      },
    });
    assert.equal(parts.status, 200);
    assert.equal(parts.data.parts.length, 2);
    for (const part of parts.data.parts) {
      const sent = await fetch(part.presignedUrl, { method: 'PUT', body: 'y'.repeat(8) });
      assert.equal(sent.status, 200);
    }
    const completed = await call('complete-upload', {
      ip,
      body: {
        s3Key: started.data.s3Key,
        uploadId: started.data.uploadId,
        deleteToken: opened.data.deleteToken,
        parts: [
          { PartNumber: 1, ETag: 'part-1' },
          { PartNumber: 2, ETag: 'part-2' },
        ],
      },
    });
    assert.equal(completed.status, 200);
    assert.equal(state.transfers[0].status, 'active');
    assert.equal(state.objects.get(started.data.s3Key).size, 16);
    assert.equal(state.r2Writes.filter((item) => item.op === 'complete').length, 1);

    const download = await call('download-url', {
      ip,
      method: 'GET',
      search: `&shareId=multi-life1&fileId=${encodeURIComponent(state.transfers[0].id)}`,
    });
    assert.equal(download.status, 200);
    const latePart = await call('get-part-url', {
      ip,
      body: {
        s3Key: started.data.s3Key,
        uploadId: started.data.uploadId,
        deleteToken: opened.data.deleteToken,
        partNumber: 3,
      },
    });
    assert.equal(latePart.status, 403);
    assert.equal(latePart.data.code, 'UPLOAD_NOT_AUTHORIZED');
    assert.equal(latePart.data.presignedUrl, undefined);
    assert.equal(state.r2Writes.filter((item) => item.op === 'complete').length, 1);
  } finally {
    restore();
  }
});

test('simulated expired tokens and share-id deletes are refused', async () => {
  const state = createState();
  const restore = installFetch(state);
  const ip = '203.0.113.23';
  try {
    const opened = await call('open-transfer', { ip, body: { shareId: 'expire-life' } });
    for (const row of state.claims) row.expires_at = new Date(Date.now() - 1000).toISOString();
    const claim = await call('claim', {
      ip,
      body: { token: opened.data.claimToken },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(claim.status, 401);
    assert.equal(claim.data.code, 'TOKEN_EXPIRED');
    const remove = await call('delete-own', { ip, body: { token: opened.data.deleteToken } });
    assert.equal(remove.status, 401);
    assert.equal(remove.data.code, 'TOKEN_EXPIRED');

    state.transfers.push({
      id: 'owned-by-nobody',
      share_id: 'expire-life',
      file_path: 'transfers/expire-life/file.txt',
      file_size: 4,
      status: 'active',
      user_id: null,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    const shareOnly = await call('delete-own', { ip, body: { shareId: 'expire-life' } });
    assert.equal(shareOnly.status, 401);
    assert.equal(shareOnly.data.code, 'DELETE_UNAUTHORIZED');
    const signedInStranger = await call('delete-own', {
      ip,
      body: { shareId: 'expire-life' },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(signedInStranger.status, 403);
    assert.equal(signedInStranger.data.code, 'DELETE_FORBIDDEN');
    assert.equal(state.r2Deletes.length, 0);
  } finally {
    restore();
  }
});

test('simulated legacy rows still download, and a missing row or database error never signs', async () => {
  const state = createState();
  state.transfers.push({
    id: 'legacy-1',
    share_id: 'legacy-link',
    file_path: 'transfers/legacy/file.txt',
    file_size: 4,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    status: null,
    password_hash: null,
    user_id: null,
  });
  state.objects.set('transfers/legacy/file.txt', { size: 4, body: 'old' });
  const restore = installFetch(state);
  const ip = '203.0.113.24';
  try {
    const legacy = await call('download-url', {
      ip,
      method: 'GET',
      search: '&shareId=legacy-link&fileId=legacy-1',
    });
    assert.equal(legacy.status, 200);
    assert.match(legacy.data.downloadUrl, /transfers\/legacy\/file\.txt/);
    const missing = await call('download-url', {
      ip,
      method: 'GET',
      search: '&shareId=missing-link&fileId=missing-row',
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.data.downloadUrl, undefined);
  } finally {
    restore();
  }

  const failing = installFetch(state, { restStatus: 500 });
  try {
    const broken = await call('download-url', {
      ip,
      method: 'GET',
      search: '&shareId=legacy-link&fileId=legacy-1',
    });
    assert.equal(broken.status, 503);
    assert.equal(broken.data.downloadUrl, undefined);
  } finally {
    failing();
  }
});

test('simulated claim ownership failure restores the unused claim token', async () => {
  const state = createState();
  const restore = installFetch(state);
  const ip = '203.0.113.25';
  try {
    const opened = await call('open-transfer', { ip, body: { shareId: 'taken-life' } });
    const put = await call('get-put-url', {
      ip,
      body: { fileName: 'a.txt', fileSize: 4, deleteToken: opened.data.deleteToken },
    });
    await fetch(put.data.presignedUrl, { method: 'PUT', body: 'abcd' });
    await call('finalize-upload', { ip, body: { s3Key: put.data.s3Key, deleteToken: opened.data.deleteToken } });
    state.transfers[0].user_id = '22222222-2222-2222-2222-222222222222';
    const claimed = await call('claim', {
      ip,
      body: { token: opened.data.claimToken },
      headers: { authorization: 'Bearer user-jwt' },
    });
    assert.equal(claimed.status, 409);
    assert.equal(claimed.data.code, 'CLAIM_REJECTED');
    assert.equal(state.claims.find((row) => row.purpose === 'claim').used_at, null);
    assert.equal(state.transfers[0].user_id, '22222222-2222-2222-2222-222222222222');
    assert.equal(state.r2Writes.filter((item) => item.op === 'put').length, 1);
  } finally {
    restore();
  }
});

test('simulated size mismatch rejects the object and does not sign a download', async () => {
  const state = createState();
  const restore = installFetch(state);
  const ip = '203.0.113.26';
  try {
    const opened = await call('open-transfer', { ip, body: { shareId: 'short-life' } });
    const put = await call('get-put-url', {
      ip,
      body: { fileName: 'short.txt', fileSize: 12, deleteToken: opened.data.deleteToken },
    });
    await fetch(put.data.presignedUrl, { method: 'PUT', body: 'tiny' });
    const finalized = await call('finalize-upload', {
      ip,
      body: { s3Key: put.data.s3Key, deleteToken: opened.data.deleteToken },
    });
    assert.equal(finalized.status, 403);
    assert.equal(finalized.data.code, 'SIZE_MISMATCH');
    assert.equal(state.transfers[0].status, 'rejected');
    assert.equal(state.objects.has(put.data.s3Key), false);
    const download = await call('download-url', {
      ip,
      method: 'GET',
      search: `&shareId=short-life&fileId=${encodeURIComponent(state.transfers[0].id)}`,
    });
    assert.equal(download.status, 410);
    assert.equal(download.data.downloadUrl, undefined);
  } finally {
    restore();
  }
});
