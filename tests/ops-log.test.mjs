import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest as sendEmail } from '../functions/api/send-email.js';
import { handleR2Request } from '../functions/lib/r2Engine.js';
import { opsEvent } from '../functions/lib/opsLog.js';
import cleanupScheduler from '../cleanup-scheduler.js';

const ENV = {
  SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  SUPABASE_URL: 'https://example.supabase.co',
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'ak',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'sk',
  CLOUDFLARE_R2_BUCKET: 'itransfer-storage',
  CLEANUP_SECRET: 'cleanup-test',
  APP_URL: 'https://itransfer.iprudhvi.in',
  RATE_LIMITER: {
    fetch: async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
  },
};

const PASSWORD = 'super-secret-password';
const EMAIL = 'person@example.com';
const FILE_NAME = 'secret-report.pdf';
const OBJECT_MARKER = 'transfers/';

function captureLogs() {
  const lines = [];
  const original = console.log;
  console.log = (...args) => {
    lines.push(args.map((item) => String(item)).join(' '));
  };
  return {
    lines,
    restore() {
      console.log = original;
    },
    events() {
      return lines.map((line) => JSON.parse(line));
    },
  };
}

function assertPrivate(lines) {
  const text = lines.join('\n');
  assert.equal(text.includes(PASSWORD), false);
  assert.equal(text.includes(EMAIL), false);
  assert.equal(text.includes(FILE_NAME), false);
  assert.equal(text.includes(OBJECT_MARKER), false);
  assert.equal(text.includes('X-Amz-'), false);
  assert.equal(text.includes('service-test'), false);
  assert.equal(text.includes('cleanup-test'), false);
  for (const line of lines) {
    const event = JSON.parse(line);
    assert.deepEqual(Object.keys(event).filter((key) => !['event', 'result', 'category', 'durationMs', 'count'].includes(key)), []);
  }
}

function installFetch(state) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    const method = options.method || 'GET';
    if (href.includes('api.resend.com')) {
      state.resendCalls += 1;
      return new Response(JSON.stringify({ id: 'provider-message-1' }), { status: 200 });
    }
    if (method === 'HEAD') {
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    }
    if (!href.includes('/rest/v1/')) return new Response('', { status: 200 });
    const parsed = new URL(href);
    const table = parsed.pathname.split('/').pop();
    const body = options.body ? JSON.parse(options.body) : null;
    if (table === 'transfer_claims' && method === 'POST') {
      state.claims.push(...body);
      return new Response(JSON.stringify(body), { status: 201 });
    }
    if (table === 'transfer_claims' && method === 'GET') {
      const hash = decodeURIComponent(parsed.searchParams.get('token_hash') || '').replace(/^eq\./, '');
      const purpose = decodeURIComponent(parsed.searchParams.get('purpose') || '').replace(/^eq\./, '');
      return new Response(JSON.stringify(state.claims.filter((row) => row.token_hash === hash && row.purpose === purpose)), { status: 200 });
    }
    if (table === 'reserve_transfer_file' && method === 'POST') {
      if (state.reservationCode) {
        return new Response(JSON.stringify({ ok: false, code: state.reservationCode, file_path: body.p_file_path }), { status: 200 });
      }
      state.transfers.push({
        id: 'file-1',
        share_id: body.p_share_id,
        file_name: body.p_file_name,
        file_path: body.p_file_path,
        file_size: body.p_file_size,
        status: 'pending',
        password_hash: body.p_password_hash,
        expires_at: body.p_expires_at,
        max_downloads: 0,
        download_count: 0,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (table === 'transfers' && method === 'PATCH') {
      const filePath = decodeURIComponent(parsed.searchParams.get('file_path') || '').replace(/^eq\./, '');
      for (const row of state.transfers) {
        if (row.file_path === filePath) Object.assign(row, body);
      }
      return new Response('[]', { status: 200 });
    }
    if (table === 'transfers' && method === 'GET') {
      const id = decodeURIComponent(parsed.searchParams.get('id') || '').replace(/^eq\./, '');
      const shareId = decodeURIComponent(parsed.searchParams.get('share_id') || '').replace(/^eq\./, '');
      const filePath = decodeURIComponent(parsed.searchParams.get('file_path') || '').replace(/^eq\./, '');
      return new Response(JSON.stringify(state.transfers.filter((row) => (
        (!id || row.id === id) && (!shareId || row.share_id === shareId) && (!filePath || row.file_path === filePath)
      ))), { status: 200 });
    }
    if (table === 'claim_download_slot' && method === 'POST') {
      const row = state.transfers.find((item) => item.id === body.p_file_id);
      return new Response(JSON.stringify({ ok: true, download_count: 1, file_path: row.file_path }), { status: 200 });
    }
    return new Response('[]', { status: 200 });
  };
  return () => {
    globalThis.fetch = original;
  };
}

async function post(action, body, env = ENV) {
  return handleR2Request({
    request: new Request(`https://itransfer.iprudhvi.in/api/r2?action=${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.40' },
      body: JSON.stringify(body),
    }),
    env,
  });
}

test('operational events keep only short tokens', () => {
  const logs = captureLogs();
  try {
    const dropped = opsEvent({
      event: 'upload',
      result: 'https://signed.example/secret',
      category: EMAIL,
      password: PASSWORD,
      fileName: FILE_NAME,
      s3Key: 'transfers/secret-key',
      body: { recipientEmails: EMAIL },
    });
    const kept = opsEvent({
      event: 'download_authorization',
      result: 'url_issued',
      category: 'SIGNED_URL',
      durationMs: 12.4,
      count: 1,
    });
    assert.equal(dropped, null);
    assert.equal(kept.result, 'url_issued');
    assert.equal(logs.lines.length, 1);
    assertPrivate(logs.lines);
    assert.equal(logs.events()[0].durationMs, 12);
  } finally {
    logs.restore();
  }
});

test('upload, reservation, and download authorization log outcomes without secrets', async () => {
  const state = { claims: [], transfers: [], reservationCode: '', resendCalls: 0 };
  const restore = installFetch(state);
  const logs = captureLogs();
  try {
    const opened = await post('open-transfer', { expiryHours: 24 });
    const openedBody = await opened.json();
    assert.equal(opened.status, 200);

    state.reservationCode = 'STORAGE_CAP';
    const rejected = await post('get-put-url', {
      deleteToken: openedBody.deleteToken,
      fileName: FILE_NAME,
      fileSize: 12,
      password: PASSWORD,
      senderEmail: EMAIL,
      recipientEmails: EMAIL,
    });
    assert.equal(rejected.status, 403);
    state.reservationCode = '';

    const uploaded = await post('get-put-url', {
      deleteToken: openedBody.deleteToken,
      fileName: FILE_NAME,
      fileSize: 12,
      password: PASSWORD,
      senderEmail: EMAIL,
    });
    const uploadedBody = await uploaded.json();
    assert.equal(uploaded.status, 200);
    assert.match(uploadedBody.presignedUrl, /X-Amz-Signature=/);

    const finalized = await post('finalize-upload', {
      deleteToken: openedBody.deleteToken,
      s3Key: uploadedBody.s3Key,
    });
    assert.equal(finalized.status, 200);

    const issued = await handleR2Request({
      request: new Request(`https://itransfer.iprudhvi.in/api/r2?action=download-url&shareId=${uploadedBody.shareId}&fileId=file-1`, {
        headers: {
          'cf-connecting-ip': '198.51.100.40',
          'x-transfer-password': PASSWORD,
        },
      }),
      env: ENV,
    });
    const issuedBody = await issued.json();
    assert.equal(issued.status, 200);
    assert.match(issuedBody.downloadUrl, /X-Amz-Signature=/);

    const parts = await post('get-part-urls', {
      deleteToken: openedBody.deleteToken,
      s3Key: uploadedBody.s3Key,
      uploadId: 'upload-1',
      partNumbers: [1, 2, 3],
    });
    assert.equal(parts.status, 403);

    const events = logs.events();
    assert.equal(events.filter((event) => event.event === 'reservation' && event.result === 'rejected' && event.category === 'STORAGE_CAP').length, 1);
    assert.equal(events.filter((event) => event.event === 'upload' && event.result === 'url_issued').length, 1);
    assert.equal(events.filter((event) => event.event === 'upload' && event.result === 'activated').length, 1);
    assert.equal(events.filter((event) => event.event === 'download_authorization' && event.result === 'url_issued' && event.category === 'SIGNED_URL').length, 1);
    assert.equal(events.some((event) => event.result === 'downloaded'), false);
    assert.equal(textHas(logs.lines, uploadedBody.presignedUrl), false);
    assert.equal(textHas(logs.lines, issuedBody.downloadUrl), false);
    assert.equal(textHas(logs.lines, uploadedBody.s3Key), false);
    assert.equal(textHas(logs.lines, openedBody.deleteToken), false);
    assertPrivate(logs.lines);
  } finally {
    logs.restore();
    restore();
  }
});

test('a blocked limiter logs one rate-limit failure and does not issue a download URL', async () => {
  const logs = captureLogs();
  try {
    const response = await handleR2Request({
      request: new Request('https://itransfer.iprudhvi.in/api/r2?action=download-url&shareId=share-1&fileId=11111111-1111-1111-1111-111111111111', {
        headers: { 'cf-connecting-ip': '198.51.100.40', 'x-transfer-password': PASSWORD },
      }),
      env: {
        ...ENV,
        RATE_LIMITER: { fetch: async () => new Response(JSON.stringify({ allowed: false }), { status: 200 }) },
      },
    });
    assert.equal(response.status, 429);
    assert.deepEqual(logs.events(), [{ event: 'rate_limit', result: 'blocked', category: 'RATE_LIMITED' }]);
    assertPrivate(logs.lines);
  } finally {
    logs.restore();
  }
});

test('email logs provider acceptance separately from delivery and omits addresses', async () => {
  const state = { claims: [], transfers: [], resendCalls: 0 };
  const restore = installFetch(state);
  const logs = captureLogs();
  try {
    const response = await sendEmail({
      request: new Request('https://itransfer.iprudhvi.in/api/send-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.40' },
        body: JSON.stringify({
          shareId: 'mail-share',
          recipientEmails: EMAIL,
          senderEmail: EMAIL,
          password: PASSWORD,
          fileName: FILE_NAME,
          downloadUrl: 'https://evil.example/secret-file',
        }),
      }),
      env: { ...ENV, RESEND_API_KEY: 're_test_secret' },
    });
    const body = await response.json();
    assert.equal(body.status, 'accepted');
    assert.equal(body.delivery, 'unconfirmed');
    assert.equal(state.resendCalls, 1);
    assert.equal(logs.events().some((event) => event.event === 'email' && event.result === 'provider_accepted' && event.category === 'UNCONFIRMED_DELIVERY'), true);
    assert.equal(logs.events().some((event) => event.result === 'delivered'), false);
    assert.equal(textHas(logs.lines, 're_test_secret'), false);
    assertPrivate(logs.lines);
  } finally {
    logs.restore();
    restore();
  }
});

test('cleanup failures log a category and drop the response body', async () => {
  const logs = captureLogs();
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: 'failed',
    file_path: 'transfers/secret-object-key',
    email: EMAIL,
  }), { status: 500 });
  try {
    await assert.rejects(
      () => cleanupScheduler.scheduled({}, { CLEANUP_SECRET: 'cleanup-test' }),
      /Cleanup failed \(HTTP 500\)$/,
    );
    assert.deepEqual(logs.events().map(({ durationMs, ...event }) => event), [
      { event: 'cleanup', result: 'failed', category: 'SCHEDULER_REJECTED' },
    ]);
    assert.equal(logs.lines.join('\n').includes('secret-object-key'), false);
    assertPrivate(logs.lines);
  } finally {
    logs.restore();
    globalThis.fetch = original;
  }
});

function textHas(lines, value) {
  return lines.join('\n').includes(value);
}
