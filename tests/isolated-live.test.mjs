import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { loadIsolatedEnv } from '../functions/lib/localIsolation.js';

const APP = 'http://127.0.0.1:5174';
const LIVE = process.env.ITRANSFER_E2E === '1';

function loopbackOrigin(value, port) {
  const url = new URL(value);
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(url.hostname), value);
  if (port) assert.equal(url.port, String(port));
  else assert.match(url.port, /^\d+$/);
  assert.notEqual(url.port, '54321');
  assert.equal(url.protocol, 'http:');
  return url.origin;
}

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

function assertLocalDatabase() {
  const dir = sql("select current_setting('data_directory')");
  assert.ok(dir === '/var/lib/postgresql/data' || dir.includes('/.supabase/stacks/'), dir);
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

async function cleanup(secret, header = secret) {
  const response = await fetch(`${APP}/api/r2?action=cleanup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(header ? { 'x-cleanup-secret': header } : {}),
    },
    body: '{}',
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function putObject(url, bytes) {
  const target = new URL(url);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '9000');
  const response = await fetch(url, { method: 'PUT', body: bytes });
  assert.equal(response.status, 200, 'local object upload failed');
  return response.headers.get('etag');
}

async function openAndStore({ token, bytes, fileName, extra = {} }) {
  const opened = await api('open-transfer', { body: { expiryHours: 24 }, token });
  assert.equal(opened.status, 200, opened.data.code || 'open failed');
  const stored = await api('get-put-url', {
    token,
    body: {
      deleteToken: opened.data.deleteToken,
      fileName,
      fileSize: bytes.length,
      contentType: 'application/octet-stream',
      ...extra,
    },
  });
  assert.equal(stored.status, 200, stored.data.code || 'reservation failed');
  await putObject(stored.data.presignedUrl, bytes);
  const final = await api('finalize-upload', {
    token,
    body: { deleteToken: opened.data.deleteToken, s3Key: stored.data.s3Key },
  });
  assert.equal(final.status, 200, final.data.code || 'finalize failed');
  return opened.data;
}

test('isolated local services cover transfers, limits, requests, and cleanup', { skip: LIVE ? false : 'set ITRANSFER_E2E=1 to use the local stack' }, async () => {
  const env = loadIsolatedEnv(process.cwd());
  delete env.ITRANSFER_ISOLATED;
  delete env.RESEND_API_KEY;
  assert.match(env.CLEANUP_SECRET, /^local-[A-Za-z0-9_-]{8,80}$/);
  const apiOrigin = loopbackOrigin(env.SUPABASE_URL);
  loopbackOrigin(env.CLOUDFLARE_R2_ENDPOINT, '9000');
  assert.equal(env.CLOUDFLARE_R2_BUCKET, 'itransfer-local');
  assertLocalDatabase();
  assert.equal(sql("select count(*) from pg_proc where proname = 'reserve_transfer_file'"), '1');

  const health = await api('health', { method: 'GET' });
  assert.equal(health.status, 200);
  assert.equal(health.data.code, undefined);
  assert.equal(health.data.bucket, 'itransfer-local');
  const ordinary = await fetch('http://[::1]:5173/api/r2?action=health');
  const ordinaryBody = await ordinary.json();
  assert.equal(ordinaryBody.code, 'LOCAL_API_DISABLED');

  const email = `isolated-${Date.now()}@example.com`;
  const password = randomBytes(18).toString('hex');
  const signup = await fetch(`${apiOrigin}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const session = await signup.json();
  const access = session.access_token || session.session?.access_token;
  const userId = session.user?.id || session.id;
  assert.equal(signup.status, 200);
  assert.ok(access);
  assert.match(userId, /^[0-9a-f-]{36}$/i);

  const shareIds = [];
  try {
    const note = Buffer.from('hello local');
    const owned = await openAndStore({ token: access, bytes: note, fileName: 'note.txt' });
    shareIds.push(owned.shareId);
    const claimed = await api('claim', { token: access, body: { token: owned.claimToken, shareId: owned.shareId } });
    assert.equal(claimed.status, 200, claimed.data.code);
    const renamed = await api('rename-transfer', { token: access, body: { shareId: owned.shareId, subject: 'Local note' } });
    assert.equal(renamed.status, 200, renamed.data.code);
    const mine = await api('my-transfers', { method: 'GET', token: access });
    assert.equal(mine.status, 200);
    const listed = mine.data.transfers.find((item) => item.shareId === owned.shareId);
    assert.equal(listed.subject, 'Local note');
    assert.equal(listed.files[0].name, 'note.txt');
    const removed = await api('delete-own', { token: access, body: { shareId: owned.shareId } });
    assert.equal(removed.status, 200, removed.data.code);
    const afterDelete = await api('share-meta', { method: 'GET', search: `&shareId=${owned.shareId}` });
    assert.equal(afterDelete.status, 410);
    assert.equal(afterDelete.data.code, 'EXPIRED');

    const capShare = await api('open-transfer', { body: { expiryHours: 1 } });
    shareIds.push(capShare.data.shareId);
    const raced = await Promise.all([
      api('get-put-url', { body: { deleteToken: capShare.data.deleteToken, fileName: 'a.bin', fileSize: 4_000_000_000, contentType: 'application/octet-stream' } }),
      api('get-put-url', { body: { deleteToken: capShare.data.deleteToken, fileName: 'b.bin', fileSize: 4_000_000_000, contentType: 'application/octet-stream' } }),
    ]);
    assert.equal(raced.filter((item) => item.status === 200).length, 1);
    assert.equal(raced.filter((item) => item.status === 403 && item.data.code === 'TRANSFER_TOO_LARGE').length, 1);
    const exact = await api('open-transfer', { body: { expiryHours: 1 } });
    shareIds.push(exact.data.shareId);
    const pair = await Promise.all([
      api('get-put-url', { body: { deleteToken: exact.data.deleteToken, fileName: 'c.bin', fileSize: 3_000_000_000, contentType: 'application/octet-stream' } }),
      api('get-put-url', { body: { deleteToken: exact.data.deleteToken, fileName: 'd.bin', fileSize: 3_000_000_000, contentType: 'application/octet-stream' } }),
    ]);
    assert.deepEqual(pair.map((item) => item.status).sort(), [200, 200]);
    const occupied = sql(`select coalesce(sum(file_size), 0) from public.transfers where share_id = '${sqlId(exact.data.shareId)}' and coalesce(status, 'active') not in ('rejected', 'expired', 'released')`);
    assert.equal(occupied, '6000000000');

    const multiBytes = Buffer.from('multipart-local');
    const multi = await api('open-transfer', { body: { expiryHours: 1 } });
    shareIds.push(multi.data.shareId);
    const initiated = await api('initiate-upload', {
      body: {
        deleteToken: multi.data.deleteToken,
        fileName: 'part.txt',
        fileSize: multiBytes.length,
        contentType: 'application/octet-stream',
      },
    });
    assert.equal(initiated.status, 200, initiated.data.code);
    const parts = await api('get-part-urls', {
      body: { deleteToken: multi.data.deleteToken, s3Key: initiated.data.s3Key, uploadId: initiated.data.uploadId, partNumbers: [1] },
    });
    assert.equal(parts.status, 200, parts.data.code);
    const etag = await putObject(parts.data.parts[0].presignedUrl, multiBytes);
    const completed = await api('complete-upload', {
      body: {
        deleteToken: multi.data.deleteToken,
        s3Key: initiated.data.s3Key,
        uploadId: initiated.data.uploadId,
        parts: [{ PartNumber: 1, ETag: etag }],
      },
    });
    assert.equal(completed.status, 200, completed.data.code);
    const multiMeta = await api('share-meta', { method: 'GET', search: `&shareId=${multi.data.shareId}` });
    assert.equal(multiMeta.status, 200);
    const multiFile = multiMeta.data.files[0];
    const multiDownload = await api('download-url', { method: 'GET', search: `&shareId=${multi.data.shareId}&fileId=${multiFile.id}` });
    assert.equal(multiDownload.status, 200);
    const multiBody = await fetch(multiDownload.data.downloadUrl);
    assert.equal(await multiBody.text(), 'multipart-local');

    const request = await api('create-request', { token: access, body: { title: 'Local request', instructions: 'Send a small file' } });
    assert.equal(request.status, 200, request.data.code);
    const requestedBytes = Buffer.from('requested');
    const requested = await api('open-transfer', { body: { expiryHours: 1 } });
    shareIds.push(requested.data.shareId);
    const requestedPut = await api('get-put-url', {
      body: {
        deleteToken: requested.data.deleteToken,
        requestId: request.data.requestId,
        fileName: 'asked.txt',
        fileSize: requestedBytes.length,
        contentType: 'text/plain',
      },
    });
    assert.equal(requestedPut.status, 200, requestedPut.data.code);
    await putObject(requestedPut.data.presignedUrl, requestedBytes);
    assert.equal((await api('finalize-upload', { body: { deleteToken: requested.data.deleteToken, s3Key: requestedPut.data.s3Key } })).status, 200);
    assert.equal((await api('close-request', { token: access, body: { requestId: request.data.requestId } })).status, 200);
    const closed = await api('get-put-url', {
      body: {
        deleteToken: requested.data.deleteToken,
        requestId: request.data.requestId,
        fileName: 'late.txt',
        fileSize: 4,
        contentType: 'text/plain',
      },
    });
    assert.equal(closed.status, 410);
    assert.equal(closed.data.code, 'REQUEST_CLOSED');

    const secretBytes = Buffer.from('secret');
    const locked = await openAndStore({
      bytes: secretBytes,
      fileName: 'secret.txt',
      extra: { password: 'local-pass' },
    });
    shareIds.push(locked.shareId);
    const meta = await api('share-meta', { method: 'GET', search: `&shareId=${locked.shareId}` });
    const fileId = meta.data.files[0].id;
    const missingPassword = await api('download-url', { method: 'GET', search: `&shareId=${locked.shareId}&fileId=${fileId}` });
    assert.equal(missingPassword.status, 401);
    assert.equal(missingPassword.data.code, 'PASSWORD_REQUIRED');
    const wrongPassword = await api('download-url', { method: 'GET', password: 'nope', search: `&shareId=${locked.shareId}&fileId=${fileId}` });
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.data.code, 'PASSWORD_INCORRECT');
    const verified = await api('verify-password', { body: { shareId: locked.shareId, inputPassword: 'local-pass' } });
    assert.equal(verified.status, 200);
    const openedDownload = await api('download-url', { method: 'GET', password: 'local-pass', search: `&shareId=${locked.shareId}&fileId=${fileId}` });
    assert.equal(openedDownload.status, 200);
    assert.equal(await (await fetch(openedDownload.data.downloadUrl)).text(), 'secret');

    const limited = await api('open-transfer', { body: { expiryHours: 1 } });
    shareIds.push(limited.data.shareId);
    const firstBytes = Buffer.from('one');
    const secondBytes = Buffer.from('two');
    const first = await api('get-put-url', {
      body: { deleteToken: limited.data.deleteToken, fileName: 'one.txt', fileSize: firstBytes.length, contentType: 'text/plain', maxDownloads: 1 },
    });
    const second = await api('get-put-url', {
      body: { deleteToken: limited.data.deleteToken, fileName: 'two.txt', fileSize: secondBytes.length, contentType: 'text/plain', maxDownloads: 1 },
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    await putObject(first.data.presignedUrl, firstBytes);
    await putObject(second.data.presignedUrl, secondBytes);
    assert.equal((await api('finalize-upload', { body: { deleteToken: limited.data.deleteToken, s3Key: first.data.s3Key } })).status, 200);
    assert.equal((await api('finalize-upload', { body: { deleteToken: limited.data.deleteToken, s3Key: second.data.s3Key } })).status, 200);
    const limitMeta = await api('share-meta', { method: 'GET', search: `&shareId=${limited.data.shareId}` });
    const one = limitMeta.data.files.find((file) => file.fileName === 'one.txt');
    const two = limitMeta.data.files.find((file) => file.fileName === 'two.txt');
    assert.equal((await api('download-url', { method: 'GET', search: `&shareId=${limited.data.shareId}&fileId=${one.id}` })).status, 200);
    const blocked = await api('download-url', { method: 'GET', search: `&shareId=${limited.data.shareId}&fileId=${one.id}` });
    assert.equal(blocked.status, 410);
    assert.equal(blocked.data.code, 'DOWNLOAD_LIMIT');
    assert.equal((await api('download-url', { method: 'GET', search: `&shareId=${limited.data.shareId}&fileId=${two.id}` })).status, 200);
    const unlimited = await openAndStore({ bytes: Buffer.from('free'), fileName: 'free.txt', extra: { maxDownloads: 0 } });
    shareIds.push(unlimited.shareId);
    const freeMeta = await api('share-meta', { method: 'GET', search: `&shareId=${unlimited.shareId}` });
    assert.equal(freeMeta.data.files[0].maxDownloads, 0);
    assert.equal((await api('download-url', { method: 'GET', search: `&shareId=${unlimited.shareId}&fileId=${freeMeta.data.files[0].id}` })).status, 200);
    assert.equal((await api('download-url', { method: 'GET', search: `&shareId=${unlimited.shareId}&fileId=${freeMeta.data.files[0].id}` })).status, 200);

    const expiring = await openAndStore({ bytes: Buffer.from('old'), fileName: 'old.txt' });
    shareIds.push(expiring.shareId);
    sql(`update public.transfers set expires_at = now() - interval '1 minute' where share_id = '${sqlId(expiring.shareId)}'`);
    const expired = await api('share-meta', { method: 'GET', search: `&shareId=${expiring.shareId}` });
    assert.equal(expired.status, 410);
    assert.equal(expired.data.code, 'EXPIRED');

    const abandoned = await api('open-transfer', { body: { expiryHours: 24 } });
    shareIds.push(abandoned.data.shareId);
    const abandonedPut = await api('get-put-url', {
      body: { deleteToken: abandoned.data.deleteToken, fileName: 'abandoned.txt', fileSize: 4, contentType: 'text/plain' },
    });
    assert.equal(abandonedPut.status, 200, abandonedPut.data.code);
    sql(`update public.transfers set created_at = now() - interval '20 minutes' where file_path = '${abandonedPut.data.s3Key.replace(/'/g, '')}'`);
    const beforeFailure = sql(`select status || '|' || file_size::text from public.transfers where file_path = '${abandonedPut.data.s3Key}'`);
    const missingHeader = await cleanup(env.CLEANUP_SECRET, '');
    assert.equal(missingHeader.status, 401);
    assert.equal(missingHeader.data.code, 'UNAUTHORIZED');
    const wrongSecret = await cleanup(env.CLEANUP_SECRET, 'local-wrong-secret-value');
    assert.equal(wrongSecret.status, 401);
    assert.equal(wrongSecret.data.code, 'UNAUTHORIZED');
    assert.equal(sql(`select status || '|' || file_size::text from public.transfers where file_path = '${abandonedPut.data.s3Key}'`), beforeFailure);
    const listener = execFileSync('lsof', ['-nP', '-t', '-iTCP:9000', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim();
    process.kill(Number(listener), 'SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    let failedStatus = 200;
    try {
      const failed = await cleanup(env.CLEANUP_SECRET);
      failedStatus = failed.status;
    } catch {
      failedStatus = 0;
    }
    assert.notEqual(failedStatus, 200);
    assert.equal(sql(`select status || '|' || file_size::text from public.transfers where file_path = '${abandonedPut.data.s3Key}'`), beforeFailure);
    const restarted = spawn('/opt/homebrew/opt/minio/bin/minio', ['server', '--address', '127.0.0.1:9000', '--console-address', '127.0.0.1:9001', '/tmp/itransfer-minio-data'], {
      env: { ...process.env, MINIO_ROOT_USER: env.CLOUDFLARE_R2_ACCESS_KEY_ID, MINIO_ROOT_PASSWORD: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY },
      stdio: 'ignore',
    });
    restarted.unref();
    let healthy = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const probe = await fetch('http://127.0.0.1:9000/minio/health/live');
        if (probe.ok) {
          healthy = true;
          break;
        }
      } catch {
        /* still starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(healthy, true);
    const recovered = await cleanup(env.CLEANUP_SECRET);
    assert.equal(recovered.status, 200);
    assert.ok(recovered.data.releasedCount >= 1);
    assert.equal(sql(`select status from public.transfers where file_path = '${abandonedPut.data.s3Key}'`), 'released');
    const occupiedAfterRelease = sql("select coalesce(sum(file_size), 0) from public.transfers where file_path = '" + abandonedPut.data.s3Key + "' and coalesce(status, 'active') not in ('rejected', 'expired', 'released')");
    assert.equal(occupiedAfterRelease, '0');
    const again = await cleanup(env.CLEANUP_SECRET);
    assert.equal(again.status, 200);
    assert.equal(again.data.releasedCount, 0);
    assert.equal(sql(`select status from public.transfers where file_path = '${abandonedPut.data.s3Key}'`), 'released');

    const live = await api('open-transfer', { body: { expiryHours: 24 } });
    shareIds.push(live.data.shareId);
    const liveUpload = await api('initiate-upload', {
      body: { deleteToken: live.data.deleteToken, fileName: 'live.txt', fileSize: 8, contentType: 'text/plain' },
    });
    assert.equal(liveUpload.status, 200, liveUpload.data.code);
    const protectedBytes = sql(`select coalesce(sum(file_size), 0) from public.transfers where share_id = '${sqlId(live.data.shareId)}' and coalesce(status, 'active') not in ('rejected', 'expired', 'released')`);
    const protectedCleanup = await cleanup(env.CLEANUP_SECRET);
    assert.equal(protectedCleanup.status, 200);
    assert.equal(sql(`select status || '|' || coalesce(multipart_upload_id, '') from public.transfers where file_path = '${liveUpload.data.s3Key}'`), `pending|${liveUpload.data.uploadId}`);
    assert.equal(sql(`select coalesce(sum(file_size), 0) from public.transfers where share_id = '${sqlId(live.data.shareId)}' and coalesce(status, 'active') not in ('rejected', 'expired', 'released')`), protectedBytes);

    const expiredObject = await openAndStore({ bytes: Buffer.from('gone'), fileName: 'gone.txt' });
    shareIds.push(expiredObject.shareId);
    const expiredKey = sql(`select file_path from public.transfers where share_id = '${sqlId(expiredObject.shareId)}'`);
    sql(`update public.transfers set expires_at = now() - interval '2 minutes' where share_id = '${sqlId(expiredObject.shareId)}'`);
    const keptBytes = sql(`select coalesce(sum(file_size), 0) from public.transfers where share_id = '${sqlId(live.data.shareId)}' and coalesce(status, 'active') not in ('rejected', 'expired', 'released')`);
    const purged = await cleanup(env.CLEANUP_SECRET);
    assert.equal(purged.status, 200);
    assert.equal(sql(`select status from public.transfers where file_path = '${expiredKey}'`), 'expired');
    assert.equal(sql(`select coalesce(sum(file_size), 0) from public.transfers where share_id = '${sqlId(live.data.shareId)}' and coalesce(status, 'active') not in ('rejected', 'expired', 'released')`), keptBytes);
    const { HeadObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
    const storage = new S3Client({
      region: env.CLOUDFLARE_R2_REGION,
      endpoint: env.CLOUDFLARE_R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });
    await assert.rejects(
      storage.send(new HeadObjectCommand({ Bucket: env.CLOUDFLARE_R2_BUCKET, Key: expiredKey })),
      (error) => error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound',
    );
  } finally {
    for (const shareId of shareIds) {
      if (!/^[a-z0-9_-]{4,80}$/.test(String(shareId || ''))) continue;
      const safe = sqlId(shareId);
      sql(`delete from public.transfer_claims where share_id = '${safe}'`);
      sql(`delete from public.transfers where share_id = '${safe}'`);
    }
    if (userId) {
      await fetch(`${apiOrigin}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }
  }
});
