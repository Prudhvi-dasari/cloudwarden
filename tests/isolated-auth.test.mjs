/**
 * Live authorization against the isolated stack only.
 * Skipped unless ITRANSFER_E2E=1. This is not a browser test.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadIsolatedEnv } from '../functions/lib/localIsolation.js';

const APP = 'http://127.0.0.1:5174';
const LIVE = process.env.ITRANSFER_E2E === '1';

function dbUrl() {
  const url = new URL(loadIsolatedEnv(process.cwd()).DB_URL);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.protocol, 'postgresql:');
  assert.match(url.port, /^\d+$/);
  assert.notEqual(url.port, '54321');
  return url.toString();
}

function sql(statement) {
  return execFileSync('psql', [dbUrl(), '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-c', statement], {
    encoding: 'utf8',
  }).trim();
}

function sqlId(value) {
  const id = String(value || '');
  assert.match(id, /^[a-z0-9_-]{4,80}$/);
  return id;
}

async function api(action, { method = 'POST', body, token, password, search = '' } = {}) {
  const response = await fetch(`${APP}/api/r2?action=${action}${search}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(password ? { 'x-transfer-password': password } : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function putObject(url, bytes) {
  const target = new URL(url);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '9000');
  const response = await fetch(url, { method: 'PUT', body: bytes });
  assert.equal(response.status, 200);
}

async function signup(origin, env, label) {
  const email = `isolated-${label}-${Date.now()}@example.com`;
  const password = randomBytes(18).toString('hex');
  const response = await fetch(`${origin}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json();
  const access = session.access_token || session.session?.access_token;
  const userId = session.user?.id || session.id;
  assert.equal(response.status, 200);
  assert.ok(access);
  assert.match(userId, /^[0-9a-f-]{36}$/i);
  return { email, access, userId };
}

function transferState(shareId) {
  return sql(`select coalesce(status, '') || '|' || coalesce(user_id::text, '') || '|' || coalesce(subject, '') || '|' || file_size::text || '|' || download_count::text || '|' || file_path from public.transfers where share_id = '${sqlId(shareId)}' order by file_name`);
}

test('isolated accounts cannot cross private transfer or request boundaries', { skip: LIVE ? false : 'set ITRANSFER_E2E=1 to use the local stack' }, async () => {
  const env = loadIsolatedEnv(process.cwd());
  const apiUrl = new URL(env.SUPABASE_URL);
  assert.equal(apiUrl.hostname, '127.0.0.1');
  assert.match(apiUrl.port, /^\d+$/);
  assert.notEqual(apiUrl.port, '54321');
  const dataDirectory = sql("select current_setting('data_directory')");
  assert.ok(dataDirectory === '/var/lib/postgresql/data' || dataDirectory.includes('/.supabase/stacks/'), dataDirectory);
  const storage = new S3Client({
    region: env.CLOUDFLARE_R2_REGION,
    endpoint: env.CLOUDFLARE_R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  const owner = await signup(apiUrl.origin, env, 'owner');
  const other = await signup(apiUrl.origin, env, 'other');
  const shareIds = [];
  const requestIds = [];

  try {
    const opened = await api('open-transfer', { token: owner.access, body: { expiryHours: 24 } });
    assert.equal(opened.status, 200, opened.data.code);
    shareIds.push(opened.data.shareId);
    const bytes = Buffer.from('owner-private');
    const stored = await api('get-put-url', {
      token: owner.access,
      body: {
        deleteToken: opened.data.deleteToken,
        fileName: 'private.txt',
        fileSize: bytes.length,
        contentType: 'text/plain',
      },
    });
    assert.equal(stored.status, 200, stored.data.code);
    await putObject(stored.data.presignedUrl, bytes);
    assert.equal((await api('finalize-upload', {
      token: owner.access,
      body: { deleteToken: opened.data.deleteToken, s3Key: stored.data.s3Key },
    })).status, 200);
    const claimed = await api('claim', {
      token: owner.access,
      body: { token: opened.data.claimToken, shareId: opened.data.shareId },
    });
    assert.equal(claimed.status, 200, claimed.data.code);
    const replayedClaim = await api('claim', {
      token: other.access,
      body: { token: opened.data.claimToken, shareId: opened.data.shareId },
    });
    assert.equal(replayedClaim.status, 401);
    assert.equal(replayedClaim.data.code, 'TOKEN_USED');
    const ownedState = transferState(opened.data.shareId);
    assert.match(ownedState, new RegExp(`active\\|${owner.userId}\\|`));

    const otherList = await api('my-transfers', { method: 'GET', token: other.access });
    assert.equal(otherList.status, 200);
    assert.equal(otherList.data.transfers.some((item) => item.shareId === opened.data.shareId), false);
    const guestList = await api('my-transfers', { method: 'GET' });
    assert.equal(guestList.status, 401);
    assert.equal(guestList.data.code, 'AUTH_REQUIRED');
    const badToken = await api('my-transfers', { method: 'GET', token: 'not-a-session' });
    assert.equal(badToken.status, 401);
    assert.equal(badToken.data.code, 'AUTH_REQUIRED');

    const otherRename = await api('rename-transfer', {
      token: other.access,
      body: { shareId: opened.data.shareId, subject: 'Taken' },
    });
    assert.equal(otherRename.status, 403);
    assert.equal(otherRename.data.code, 'RENAME_FORBIDDEN');
    const guestRename = await api('rename-transfer', {
      body: { shareId: opened.data.shareId, subject: 'Taken' },
    });
    assert.equal(guestRename.status, 401);
    assert.equal(guestRename.data.code, 'AUTH_REQUIRED');
    assert.equal(transferState(opened.data.shareId), ownedState);

    const beforeHead = await storage.send(new HeadObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET,
      Key: stored.data.s3Key,
    }));
    const otherDelete = await api('delete-own', { token: other.access, body: { shareId: opened.data.shareId } });
    assert.equal(otherDelete.status, 403);
    assert.equal(otherDelete.data.code, 'DELETE_FORBIDDEN');
    const guestDelete = await api('delete-own', { body: { shareId: opened.data.shareId } });
    assert.equal(guestDelete.status, 401);
    assert.equal(guestDelete.data.code, 'DELETE_UNAUTHORIZED');
    const mismatch = await api('delete-own', {
      body: { token: opened.data.deleteToken, shareId: 'other-share' },
    });
    assert.equal(mismatch.status, 403);
    assert.equal(mismatch.data.code, 'DELETE_MISMATCH');
    const afterHead = await storage.send(new HeadObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET,
      Key: stored.data.s3Key,
    }));
    assert.equal(afterHead.ContentLength, beforeHead.ContentLength);
    assert.equal(transferState(opened.data.shareId), ownedState);

    const append = await api('get-put-url', {
      token: other.access,
      body: { shareId: opened.data.shareId, fileName: 'extra.txt', fileSize: 4, contentType: 'text/plain' },
    });
    assert.equal(append.status, 401);
    assert.equal(append.data.code, 'TOKEN_INVALID');
    assert.equal(sql(`select count(*) from public.transfers where share_id = '${sqlId(opened.data.shareId)}'`), '1');

    const meta = await api('share-meta', { method: 'GET', search: `&shareId=${opened.data.shareId}` });
    assert.equal(meta.status, 200);
    const metaText = JSON.stringify(meta.data);
    assert.equal(metaText.includes('password_hash'), false);
    assert.equal(metaText.includes('token_hash'), false);
    assert.equal(metaText.includes(stored.data.s3Key), false);
    const fileId = meta.data.files[0].id;
    const guestDownload = await api('download-url', { method: 'GET', search: `&shareId=${opened.data.shareId}&fileId=${fileId}` });
    assert.equal(guestDownload.status, 200);
    const unknownShare = await api('share-meta', { method: 'GET', search: '&shareId=missing-share' });
    assert.equal(unknownShare.status, 404);
    assert.equal(unknownShare.data.code, 'NOT_FOUND');
    const invalidShare = await api('download-url', { method: 'GET', search: '&shareId=***&fileId=not-valid' });
    assert.equal(invalidShare.status, 400);
    assert.equal(invalidShare.data.code, 'DOWNLOAD_INVALID');

    const locked = await api('open-transfer', { body: { expiryHours: 24 } });
    shareIds.push(locked.data.shareId);
    const secretBytes = Buffer.from('secret');
    const lockedPut = await api('get-put-url', {
      body: {
        deleteToken: locked.data.deleteToken,
        fileName: 'secret.txt',
        fileSize: secretBytes.length,
        contentType: 'text/plain',
        password: 'correct-horse',
        maxDownloads: 1,
      },
    });
    assert.equal(lockedPut.status, 200, lockedPut.data.code);
    await putObject(lockedPut.data.presignedUrl, secretBytes);
    assert.equal((await api('finalize-upload', {
      body: { deleteToken: locked.data.deleteToken, s3Key: lockedPut.data.s3Key },
    })).status, 200);
    const lockedMeta = await api('share-meta', { method: 'GET', search: `&shareId=${locked.data.shareId}` });
    const lockedId = lockedMeta.data.files[0].id;
    const lockedSearch = `&shareId=${locked.data.shareId}&fileId=${lockedId}`;
    const beforePassword = transferState(locked.data.shareId);
    const missingPassword = await api('download-url', { method: 'GET', token: owner.access, search: lockedSearch });
    assert.equal(missingPassword.status, 401);
    assert.equal(missingPassword.data.code, 'PASSWORD_REQUIRED');
    const bodyPassword = await api('download-url', {
      token: other.access,
      search: lockedSearch,
      body: { password: 'correct-horse', downloadCount: 0 },
    });
    assert.equal(bodyPassword.status, 401);
    assert.equal(bodyPassword.data.code, 'PASSWORD_REQUIRED');
    const queryPassword = await api('download-url', {
      method: 'GET',
      search: `${lockedSearch}&password=correct-horse`,
    });
    assert.equal(queryPassword.status, 401);
    assert.equal(queryPassword.data.code, 'PASSWORD_REQUIRED');
    const wrongPassword = await api('download-url', { method: 'GET', password: 'nope', search: lockedSearch });
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.data.code, 'PASSWORD_INCORRECT');
    assert.equal(transferState(locked.data.shareId), beforePassword);
    const allowed = await api('download-url', { method: 'GET', password: 'correct-horse', search: lockedSearch });
    assert.equal(allowed.status, 200);
    const limited = await api('download-url', { method: 'GET', password: 'correct-horse', search: lockedSearch });
    assert.equal(limited.status, 410);
    assert.equal(limited.data.code, 'DOWNLOAD_LIMIT');
    const resetAttempt = await api('download-url', {
      method: 'POST',
      password: 'correct-horse',
      search: lockedSearch,
      body: { downloadCount: 0, maxDownloads: 0 },
    });
    assert.equal(resetAttempt.status, 410);
    assert.equal(resetAttempt.data.code, 'DOWNLOAD_LIMIT');
    const anonPatch = await fetch(`${apiUrl.origin}/rest/v1/transfers?id=eq.${lockedId}`, {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify({ download_count: 0, status: 'active' }),
    });
    assert.notEqual(anonPatch.status, 200);
    const userPatch = await fetch(`${apiUrl.origin}/rest/v1/transfers?id=eq.${lockedId}`, {
      method: 'PATCH',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${other.access}`,
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify({ download_count: 0 }),
    });
    assert.notEqual(userPatch.status, 200);
    assert.match(transferState(locked.data.shareId), /\|1\|/);

    sql(`update public.transfers set expires_at = now() - interval '1 minute' where share_id = '${sqlId(opened.data.shareId)}'`);
    const expiredCount = transferState(opened.data.shareId);
    const expiredMeta = await api('share-meta', { method: 'GET', search: `&shareId=${opened.data.shareId}` });
    assert.equal(expiredMeta.status, 410);
    assert.equal(expiredMeta.data.code, 'EXPIRED');
    const expiredDownload = await api('download-url', {
      method: 'GET',
      token: other.access,
      search: `&shareId=${opened.data.shareId}&fileId=${fileId}`,
    });
    assert.equal(expiredDownload.status, 410);
    assert.equal(expiredDownload.data.code, 'EXPIRED');
    assert.equal(transferState(opened.data.shareId), expiredCount);

    const aging = await api('open-transfer', { body: { expiryHours: 24 } });
    shareIds.push(aging.data.shareId);
    const agingBytes = Buffer.from('aging');
    const agingPut = await api('get-put-url', {
      body: {
        deleteToken: aging.data.deleteToken,
        fileName: 'aging.txt',
        fileSize: agingBytes.length,
        contentType: 'text/plain',
      },
    });
    await putObject(agingPut.data.presignedUrl, agingBytes);
    await api('finalize-upload', { body: { deleteToken: aging.data.deleteToken, s3Key: agingPut.data.s3Key } });
    const agingState = transferState(aging.data.shareId);
    sql(`update public.transfer_claims set expires_at = now() - interval '1 minute' where share_id = '${sqlId(aging.data.shareId)}' and purpose = 'delete'`);
    const expiredToken = await api('delete-own', { body: { token: aging.data.deleteToken, shareId: aging.data.shareId } });
    assert.equal(expiredToken.status, 401);
    assert.equal(expiredToken.data.code, 'TOKEN_EXPIRED');
    assert.equal(transferState(aging.data.shareId), agingState);
    const stillThere = await storage.send(new HeadObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET,
      Key: agingPut.data.s3Key,
    }));
    assert.equal(stillThere.ContentLength, agingBytes.length);

    const guestOwned = await api('open-transfer', { body: { expiryHours: 24 } });
    shareIds.push(guestOwned.data.shareId);
    const guestBytes = Buffer.from('guest');
    const guestPut = await api('get-put-url', {
      body: {
        deleteToken: guestOwned.data.deleteToken,
        fileName: 'guest.txt',
        fileSize: guestBytes.length,
        contentType: 'text/plain',
      },
    });
    await putObject(guestPut.data.presignedUrl, guestBytes);
    await api('finalize-upload', { body: { deleteToken: guestOwned.data.deleteToken, s3Key: guestPut.data.s3Key } });
    const strangerDelete = await api('delete-own', { token: other.access, body: { shareId: guestOwned.data.shareId } });
    assert.equal(strangerDelete.status, 403);
    assert.equal(strangerDelete.data.code, 'DELETE_FORBIDDEN');
    assert.match(transferState(guestOwned.data.shareId), /^active\|\|/);
    const guestRemoved = await api('delete-own', { body: { token: guestOwned.data.deleteToken, shareId: guestOwned.data.shareId } });
    assert.equal(guestRemoved.status, 200, guestRemoved.data.code);
    const replayedDelete = await api('delete-own', { body: { token: guestOwned.data.deleteToken, shareId: guestOwned.data.shareId } });
    assert.equal(replayedDelete.status, 401);
    assert.equal(replayedDelete.data.code, 'TOKEN_USED');
    assert.match(transferState(guestOwned.data.shareId), /^expired\|/);

    const created = await api('create-request', { token: owner.access, body: { title: 'Owner request' } });
    assert.equal(created.status, 200, created.data.code);
    requestIds.push(created.data.requestId);
    const guestCreate = await api('create-request', { body: { title: 'Nope' } });
    assert.equal(guestCreate.status, 401);
    assert.equal(guestCreate.data.code, 'AUTH_REQUIRED');
    const otherRequests = await api('my-requests', { method: 'GET', token: other.access });
    assert.equal(otherRequests.status, 200);
    assert.equal(otherRequests.data.requests.some((item) => item.requestId === created.data.requestId), false);
    const otherClose = await api('close-request', { token: other.access, body: { requestId: created.data.requestId } });
    assert.equal(otherClose.status, 403);
    assert.equal(otherClose.data.code, 'REQUEST_FORBIDDEN');
    assert.equal(sql(`select status from public.file_requests where request_id = '${sqlId(created.data.requestId)}'`), 'active');
    const received = await api('open-transfer', { body: { expiryHours: 24 } });
    shareIds.push(received.data.shareId);
    const receivedBytes = Buffer.from('for-owner');
    const receivedPut = await api('get-put-url', {
      body: {
        deleteToken: received.data.deleteToken,
        requestId: created.data.requestId,
        fileName: 'incoming.txt',
        fileSize: receivedBytes.length,
        contentType: 'text/plain',
      },
    });
    assert.equal(receivedPut.status, 200, receivedPut.data.code);
    await putObject(receivedPut.data.presignedUrl, receivedBytes);
    assert.equal((await api('finalize-upload', {
      body: { deleteToken: received.data.deleteToken, s3Key: receivedPut.data.s3Key },
    })).status, 200);
    const ownerRequests = await api('my-requests', { method: 'GET', token: owner.access });
    const portal = ownerRequests.data.requests.find((item) => item.requestId === created.data.requestId);
    assert.equal(portal.received.some((item) => item.shareId === received.data.shareId), true);
    const ownerCannotDeleteReceived = await api('delete-own', {
      token: owner.access,
      body: { shareId: received.data.shareId },
    });
    assert.equal(ownerCannotDeleteReceived.status, 403);
    assert.equal(ownerCannotDeleteReceived.data.code, 'DELETE_FORBIDDEN');
    assert.match(transferState(received.data.shareId), /^active\|\|/);
  } finally {
    for (const shareId of shareIds) {
      if (!/^[a-z0-9_-]{4,80}$/.test(String(shareId || ''))) continue;
      const safe = sqlId(shareId);
      sql(`delete from public.transfer_claims where share_id = '${safe}'`);
      sql(`delete from public.transfers where share_id = '${safe}'`);
    }
    for (const requestId of requestIds) {
      if (!/^[a-z0-9_-]{4,80}$/.test(String(requestId || ''))) continue;
      sql(`delete from public.file_requests where request_id = '${sqlId(requestId)}'`);
    }
    for (const userId of [owner.userId, other.userId]) {
      await fetch(`${apiUrl.origin}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }
  }
});
