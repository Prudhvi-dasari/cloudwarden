import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest } from '../functions/api/send-email.js';
import { deliverTransferMail, prepareTransferMail } from '../functions/lib/mailService.js';
import { describeEmailResult, describeExcludedRecipients } from '../src/lib/emailStatus.js';

const ENV = {
  APP_URL: 'https://itransfer.iprudhvi.in/ignored-path',
  RESEND_API_KEY: 're_test',
  EMAIL_FROM_ADDRESS: 'iTransfer <send@iprudhvi.in>',
};

function allowingLimiter() {
  return { fetch: async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }) };
}

async function post(body, env = ENV) {
  const response = await onRequest({
    request: new Request('https://itransfer.iprudhvi.in/api/send-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.70' },
      body: JSON.stringify(body),
    }),
    env: { ...env, RATE_LIMITER: allowingLimiter() },
  });
  return { status: response.status, data: await response.json() };
}

test('provider acceptance is unconfirmed and ignores a client transfer URL', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  };
  try {
    const result = await post({
      shareId: 'Mail-Share',
      recipientEmails: 'Person@Example.com, not-an-email',
      senderEmail: 'Ada',
      message: 'Hello',
      downloadUrl: 'https://evil.example/phish',
      password: 'do-not-log',
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.success, true);
    assert.equal(result.data.status, 'accepted');
    assert.equal(result.data.delivery, 'unconfirmed');
    assert.equal(result.data.provider, 'resend');
    assert.equal(result.data.downloadUrl, 'https://itransfer.iprudhvi.in/d/mail-share');
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].init.body);
    assert.equal(payload.from, 'iTransfer <send@iprudhvi.in>');
    assert.deepEqual(payload.to, ['person@example.com']);
    assert.match(payload.text, /https:\/\/itransfer\.iprudhvi\.in\/d\/mail-share/);
    assert.equal(payload.text.includes('evil.example'), false);
    assert.equal(payload.text.includes('do-not-log'), false);
    assert.match(calls[0].init.headers['Idempotency-Key'], /^[a-f0-9]{64}$/);
  } finally {
    globalThis.fetch = original;
  }
});

test('missing credentials and permanent provider rejection do not claim delivery', async () => {
  const missing = await post({ shareId: 'mail-share', recipientEmails: 'a@example.com' }, { APP_URL: ENV.APP_URL });
  assert.equal(missing.data.success, false);
  assert.equal(missing.data.status, 'fallback');
  assert.equal(missing.data.reason, 'no_smtp_configured');
  assert.match(missing.data.mailtoUrl, /^mailto:a@example.com/);

  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls.push(1);
    return new Response(JSON.stringify({ message: 'domain is not verified' }), { status: 422 });
  };
  try {
    const rejected = await post({ shareId: 'mail-share', recipientEmails: 'a@example.com' });
    assert.equal(rejected.data.success, false);
    assert.equal(rejected.data.status, 'rejected');
    assert.equal(rejected.data.delivery, 'none');
    assert.equal(rejected.data.reason, 'provider_rejected');
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('a timeout is retried once with the same idempotency key and then reported unavailable', async () => {
  const keys = [];
  let attempts = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    attempts += 1;
    keys.push(init.headers['Idempotency-Key']);
    const error = new Error('timed out');
    error.name = 'AbortError';
    throw error;
  };
  try {
    const prepared = prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'a@example.com' });
    const result = await deliverTransferMail(ENV, prepared);
    assert.equal(attempts, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(result.success, false);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reason, 'provider_timeout');
    assert.equal(result.delivery, 'unknown');
    const status = describeEmailResult(result);
    assert.equal(status.showFallback, false);
    assert.equal(status.detail.includes('Nothing has been emailed yet'), false);
    assert.equal(status.badge === 'Delivered', false);
  } finally {
    globalThis.fetch = original;
  }
});

test('a transient failure can be retried into provider acceptance', async () => {
  let attempts = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return new Response('busy', { status: 503 });
    return new Response(JSON.stringify({ id: 'email-2' }), { status: 200 });
  };
  try {
    const prepared = prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'a@example.com' });
    const result = await deliverTransferMail(ENV, prepared);
    assert.equal(attempts, 2);
    assert.equal(result.status, 'accepted');
    assert.equal(result.delivery, 'unconfirmed');
  } finally {
    globalThis.fetch = original;
  }
});

test('partial acceptance is not described as unsent, and zero accepted stays a fallback', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.to[0]);
    if (body.to[0] === 'second@example.com') {
      return new Response(JSON.stringify({ name: 'validation_error' }), { status: 422 });
    }
    return new Response(JSON.stringify({ id: 'email-3' }), { status: 200 });
  };
  try {
    const prepared = prepareTransferMail(ENV, {
      shareId: 'mail-share',
      recipientEmails: 'first@example.com, second@example.com',
    });
    const partial = await deliverTransferMail(ENV, prepared);
    assert.equal(calls.length, 2);
    assert.equal(partial.success, false);
    assert.equal(partial.status, 'partial');
    assert.equal(partial.delivery, 'unconfirmed');
    assert.equal(partial.dispatchedCount, 1);
    assert.equal(partial.mailtoUrl, undefined);
    const partialStatus = describeEmailResult(partial);
    assert.equal(partialStatus.state, 'partial');
    assert.equal(partialStatus.badge, 'Partly accepted');
    assert.equal(partialStatus.showFallback, false);
    assert.equal(partialStatus.detail.includes('Nothing has been emailed yet'), false);
    assert.equal(partialStatus.summary.includes('confirmed delivery'), false);
    assert.equal(partialStatus.badge === 'Delivered', false);
  } finally {
    globalThis.fetch = original;
  }

  const rejected = await deliverTransferMail(
    ENV,
    prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'a@example.com' }),
    { fetchImpl: async () => new Response(JSON.stringify({ message: 'no' }), { status: 422 }) },
  );
  assert.equal(rejected.dispatchedCount, 0);
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reason, 'provider_rejected');
  const rejectedStatus = describeEmailResult(rejected);
  assert.equal(rejectedStatus.state, 'not_sent');
  assert.equal(rejectedStatus.showFallback, true);
  assert.equal(rejectedStatus.detail.includes('Nothing has been emailed yet'), true);
});

test('HTTP 409 is not retried and stays uncertain or a payload mismatch', async () => {
  async function once(name) {
    let attempts = 0;
    const result = await deliverTransferMail(
      ENV,
      prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'a@example.com' }),
      {
        fetchImpl: async () => {
          attempts += 1;
          return new Response(JSON.stringify({ name }), { status: 409 });
        },
      },
    );
    return { attempts, result, status: describeEmailResult(result) };
  }

  const concurrent = await once('concurrent_idempotent_requests');
  assert.equal(concurrent.attempts, 1);
  assert.equal(concurrent.result.status, 'uncertain');
  assert.equal(concurrent.result.delivery, 'unknown');
  assert.equal(concurrent.result.reason, 'idempotency_in_progress');
  assert.equal(concurrent.result.success, false);
  assert.equal(concurrent.status.showFallback, false);
  assert.equal(concurrent.status.detail.includes('Nothing has been emailed yet'), false);
  assert.equal(concurrent.status.state, 'uncertain');
  assert.equal(concurrent.status.badge === 'Delivered', false);

  const mismatch = await once('invalid_idempotent_request');
  assert.equal(mismatch.attempts, 1);
  assert.equal(mismatch.result.status, 'idempotency_mismatch');
  assert.equal(mismatch.result.reason, 'idempotency_mismatch');
  assert.equal(mismatch.result.delivery, 'none');
  assert.equal(mismatch.status.showFallback, true);
  assert.equal(mismatch.status.detail.includes('Nothing has been emailed yet'), false);
  assert.equal(mismatch.status.detail.includes('earlier request'), true);
});

test('a connection failure is retried once and is not called a provider rejection', async () => {
  let attempts = 0;
  const result = await deliverTransferMail(
    ENV,
    prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'a@example.com' }),
    {
      fetchImpl: async () => {
        attempts += 1;
        throw new TypeError('network down');
      },
    },
  );
  assert.equal(attempts, 2);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'connection_failed');
  assert.equal(result.delivery, 'unknown');
  assert.equal(result.reason === 'provider_rejected', false);
  const status = describeEmailResult(result);
  assert.equal(status.showFallback, false);
  assert.equal(status.summary.includes('connection failed'), true);
  assert.equal(status.detail.includes('Nothing has been emailed yet'), false);
  assert.equal(status.badge === 'Delivered', false);
});

test('invalid addresses are counted without being returned, and password mail never includes the password', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'email-4' }), { status: 200 });
  };
  try {
    const result = await post({
      shareId: 'mail-share',
      recipientEmails: 'valid@example.com, not-an-email, valid@example.com',
      isPasswordProtected: true,
      password: 'mailbox-secret',
      message: 'See the link',
    });
    assert.equal(result.data.excludedCount, 1);
    assert.equal(result.data.status, 'accepted');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].to, ['valid@example.com']);
    assert.match(calls[0].text, /A password is required to download these files/);
    assert.equal(calls[0].text.includes('mailbox-secret'), false);
    assert.equal(JSON.stringify(result.data).includes('not-an-email'), false);
    assert.equal(JSON.stringify(result.data).includes('mailbox-secret'), false);
    assert.equal(describeExcludedRecipients(result.data.excludedCount).includes('not-an-email'), false);
    assert.match(describeExcludedRecipients(1), /1 address was invalid or over the limit/);
  } finally {
    globalThis.fetch = original;
  }
});

test('the transfer screen does not treat provider acceptance or a fallback as delivery', () => {
  const accepted = describeEmailResult({ success: true, status: 'accepted', delivery: 'unconfirmed' });
  assert.equal(accepted.state, 'accepted');
  assert.equal(accepted.badge, 'Accepted');
  assert.equal(accepted.summary.includes('not confirmed'), true);
  assert.equal(accepted.summary.includes('was sent'), false);

  const fallback = describeEmailResult({ success: false, status: 'fallback', provider: 'client_fallback' });
  assert.equal(fallback.state, 'not_sent');
  assert.equal(fallback.badge, 'Not sent yet');

  const ambiguous = describeEmailResult({ success: true, provider: 'resend' });
  assert.equal(ambiguous.state, 'not_sent');

  const delivered = describeEmailResult({ status: 'delivered', delivery: 'confirmed' });
  assert.equal(delivered.state, 'delivered');
  assert.equal(delivered.badge, 'Delivered');
});
