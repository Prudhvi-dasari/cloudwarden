import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest } from '../functions/api/send-email.js';
import { deliverTransferMail, prepareTransferMail, DEFAULT_EMAIL_FROM, getEmailFromAddress, isValidFromAddress } from '../functions/lib/mailService.js';
import { DEFAULT_EMAIL_FROM as API_DEFAULT_EMAIL_FROM } from '../api/send-email.js';
import { describeEmailResult, describeExcludedRecipients, interpretSendEmailResponse, emailTransportFailure } from '../src/lib/emailStatus.js';

const ENV = {
  APP_URL: 'https://itransfer.iprudhvi.in/ignored-path',
  RESEND_API_KEY: 're_test',
  EMAIL_FROM_ADDRESS: 'SendToAnyone <send@sendtoanyone.com>',
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
    assert.equal(result.data.downloadUrl, 'https://sendtoanyone.com/d/mail-share');
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].init.body);
    assert.equal(payload.from, 'SendToAnyone <send@sendtoanyone.com>');
    assert.deepEqual(payload.to, ['person@example.com']);
    assert.match(payload.text, /https:\/\/sendtoanyone\.com\/d\/mail-share/);
    assert.equal(payload.text.includes('evil.example'), false);
    assert.equal(payload.text.includes('do-not-log'), false);
    assert.match(calls[0].init.headers['Idempotency-Key'], /^[a-f0-9]{64}$/);
  } finally {
    globalThis.fetch = original;
  }
});

test('missing credentials and permanent provider rejection do not claim delivery', async () => {
  const original = globalThis.fetch;
  let leaked = 0;
  globalThis.fetch = async () => {
    leaked += 1;
    throw new Error('network must not be called');
  };
  let missing;
  try {
    missing = await post({ shareId: 'mail-share', recipientEmails: 'a@example.com' }, { APP_URL: ENV.APP_URL });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(leaked, 0);
  assert.equal(missing.status, 503);
  assert.equal(missing.data.success, false);
  assert.equal(missing.data.status, 'fallback');
  assert.equal(missing.data.reason, 'no_smtp_configured');
  assert.equal(missing.data.code, 'NO_SMTP_CONFIGURED');
  assert.match(missing.data.mailtoUrl, /^mailto:a@example.com/);

  const calls = [];
  const logs = [];
  const log = console.log;
  console.log = (...args) => logs.push(args.map(String).join(' '));
  globalThis.fetch = async () => {
    calls.push(1);
    return new Response(JSON.stringify({ name: 'validation_error', message: 'Invalid request' }), { status: 422 });
  };
  try {
    const rejected = await post({ shareId: 'mail-share', recipientEmails: 'a@example.com' });
    assert.equal(rejected.status, 502);
    assert.equal(rejected.data.success, false);
    assert.equal(rejected.data.status, 'rejected');
    assert.equal(rejected.data.delivery, 'none');
    assert.equal(rejected.data.reason, 'provider_rejected');
    assert.equal(rejected.data.code, 'PROVIDER_REJECTED');
    assert.equal(calls.length, 1);
    const logged = logs.join('\n');
    assert.equal(logged.includes('re_test'), false);
    assert.equal(logged.includes('a@example.com'), false);
    assert.equal(logged.includes('Invalid request'), false);
    assert.equal(logged.includes('provider_accepted'), false);
    assert.match(logged, /"result":"rejected"/);
  } finally {
    globalThis.fetch = original;
    console.log = log;
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
    assert.match(calls[0].html, /Password protected/);
    assert.match(calls[0].html, /#1769F5/);
    assert.equal(calls[0].html.includes('#c4a574'), false);
    assert.equal(calls[0].html.includes('mailbox-secret'), false);
    assert.match(calls[0].html, /https:\/\/sendtoanyone\.com\/d\/mail-share/);
    assert.equal(calls[0].html.includes('itransfer.iprudhvi.in'), false);
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

test('email template reflects actual chosen expiry and safely escapes user content', () => {
  const hour1 = prepareTransferMail(ENV, {
    shareId: 'exp-1h',
    recipientEmails: 'user@example.com',
    expiryHours: 1,
    senderEmail: 'Ada Lovelace <ada@example.com>',
    message: '<script>alert("xss")</script> & "quotes"',
    totalSize: 1048576,
    fileCount: 1,
  });
  assert.match(hour1.text, /Expires in: 1 hour/);
  assert.match(hour1.html, /1 hour/);
  assert.equal(hour1.html.includes('<script>'), false);
  assert.equal(hour1.html.includes('&lt;script&gt;'), true);

  const hours24 = prepareTransferMail(ENV, {
    shareId: 'exp-24h',
    recipientEmails: 'user@example.com',
    expiryHours: 24,
    totalSize: 52428800,
  });
  assert.match(hours24.text, /Expires in: 24 hours/);
  assert.match(hours24.html, /24 hours/);

  const days3 = prepareTransferMail(ENV, {
    shareId: 'exp-3d',
    recipientEmails: 'user@example.com',
    expiryHours: 72,
    totalSize: 1073741824,
  });
  assert.match(days3.text, /Expires in: 3 days/);
  assert.match(days3.html, /3 days/);
});

test('email configuration defaults to SendToAnyone <send@sendtoanyone.com> and matches across all email paths', () => {
  assert.equal(DEFAULT_EMAIL_FROM, 'SendToAnyone <send@sendtoanyone.com>');
  assert.equal(API_DEFAULT_EMAIL_FROM, 'SendToAnyone <send@sendtoanyone.com>');
  assert.equal(DEFAULT_EMAIL_FROM.includes('no-reply'), false);
  assert.equal(API_DEFAULT_EMAIL_FROM.includes('no-reply'), false);

  // When env is missing or EMAIL_FROM_ADDRESS is empty, getEmailFromAddress returns default
  assert.equal(getEmailFromAddress({}), 'SendToAnyone <send@sendtoanyone.com>');
  assert.equal(getEmailFromAddress(null), 'SendToAnyone <send@sendtoanyone.com>');
  assert.equal(getEmailFromAddress({ EMAIL_FROM_ADDRESS: '' }), 'SendToAnyone <send@sendtoanyone.com>');

  // When env specifies custom EMAIL_FROM_ADDRESS, it respects the environment
  assert.equal(getEmailFromAddress({ EMAIL_FROM_ADDRESS: 'Custom <alerts@example.com>' }), 'Custom <alerts@example.com>');
});

test('deliverTransferMail uses default sender when EMAIL_FROM_ADDRESS is omitted from env', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 'email-default' }), { status: 200 });
  };
  try {
    const envWithoutSender = {
      APP_URL: 'https://sendtoanyone.com',
      RESEND_API_KEY: 're_test',
    };
    const result = await post({
      shareId: 'test-default-from',
      recipientEmails: 'recipient@example.com',
    }, envWithoutSender);

    assert.equal(result.status, 200);
    assert.equal(result.data.success, true);
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].init.body);
    assert.equal(payload.from, 'SendToAnyone <send@sendtoanyone.com>');
    assert.equal(payload.from.includes('no-reply'), false);
  } finally {
    globalThis.fetch = original;
  }
});

test('handles replies safely: valid sender email sets reply_to without altering from address, invalid sender omits reply_to', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 'email-reply-test' }), { status: 200 });
  };
  try {
    // 1. Valid user sender email: reply_to is set, from is NOT impersonated
    const resultValid = await post({
      shareId: 'reply-share-1',
      recipientEmails: 'target@example.com',
      senderEmail: 'alice@domain.com',
    });
    assert.equal(resultValid.status, 200);
    assert.equal(calls.length, 1);
    const payload1 = JSON.parse(calls[0].init.body);
    assert.equal(payload1.from, 'SendToAnyone <send@sendtoanyone.com>');
    assert.equal(payload1.reply_to, 'alice@domain.com');

    // 2. Display name or invalid email: reply_to is omitted, from is SendToAnyone
    const resultInvalid = await post({
      shareId: 'reply-share-2',
      recipientEmails: 'target@example.com',
      senderEmail: 'Alice in Wonderland',
    });
    assert.equal(resultInvalid.status, 200);
    assert.equal(calls.length, 2);
    const payload2 = JSON.parse(calls[1].init.body);
    assert.equal(payload2.from, 'SendToAnyone <send@sendtoanyone.com>');
    assert.equal('reply_to' in payload2, false);
    assert.equal(payload2.from.includes('Alice'), false);

    // 3. Unspecified sender email: reply_to is omitted
    const resultNone = await post({
      shareId: 'reply-share-3',
      recipientEmails: 'target@example.com',
    });
    assert.equal(resultNone.status, 200);
    assert.equal(calls.length, 3);
    const payload3 = JSON.parse(calls[2].init.body);
    assert.equal(payload3.from, 'SendToAnyone <send@sendtoanyone.com>');
    assert.equal('reply_to' in payload3, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('a 2xx response without a provider message id is not acceptance and is not retried', async () => {
  let attempts = 0;
  const result = await deliverTransferMail(
    ENV,
    prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'a@example.com' }),
    {
      fetchImpl: async () => {
        attempts += 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    },
  );
  assert.equal(attempts, 1);
  assert.equal(result.success, false);
  assert.equal(result.status, 'uncertain');
  assert.equal(result.delivery, 'unknown');
  assert.equal(result.reason, 'missing_provider_id');
  assert.equal(result.code, 'MISSING_PROVIDER_ID');
  const status = describeEmailResult(result);
  assert.equal(status.badge === 'Delivered', false);
  assert.equal(status.badge === 'Accepted', false);
  assert.equal(status.showFallback, false);
});

test('an invalid configured sender is rejected without calling Resend or substituting the default', async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: 'should-not-send' }), { status: 200 });
  };
  try {
    assert.equal(isValidFromAddress('not-a-sender'), false);
    assert.equal(getEmailFromAddress({ EMAIL_FROM_ADDRESS: 'not-a-sender' }), 'not-a-sender');
    const rejected = await post(
      { shareId: 'mail-share', recipientEmails: 'a@example.com' },
      { ...ENV, EMAIL_FROM_ADDRESS: 'not-a-sender' },
    );
    assert.equal(calls, 0);
    assert.equal(rejected.status, 422);
    assert.equal(rejected.data.success, false);
    assert.equal(rejected.data.reason, 'invalid_sender');
    assert.equal(rejected.data.code, 'INVALID_SENDER');
    assert.equal(rejected.data.delivery, 'none');
    assert.equal(JSON.stringify(rejected.data).includes('not-a-sender'), false);
    assert.equal(JSON.stringify(rejected.data).includes('should-not-send'), false);

    const quoted = await post(
      { shareId: 'mail-share', recipientEmails: 'a@example.com' },
      { ...ENV, EMAIL_FROM_ADDRESS: '"SendToAnyone <send@sendtoanyone.com>"' },
    );
    assert.equal(calls, 1);
    assert.equal(quoted.status, 200);
    assert.equal(quoted.data.success, true);
    assert.equal(quoted.data.delivery, 'unconfirmed');
  } finally {
    globalThis.fetch = original;
  }
});

test('a verified-domain rejection, a bad API key, and an exhausted 503 are not success', async () => {
  let domainCalls = 0;
  const domain = await deliverTransferMail(
    ENV,
    prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'first@example.com, second@example.com' }),
    {
      fetchImpl: async () => {
        domainCalls += 1;
        return new Response(JSON.stringify({
          name: 'validation_error',
          message: 'The domain is not verified',
        }), { status: 422 });
      },
    },
  );
  assert.equal(domainCalls, 1);
  assert.equal(domain.success, false);
  assert.equal(domain.reason, 'invalid_sender');
  assert.equal(domain.dispatchedCount, 0);
  assert.equal(JSON.stringify(domain).includes('not verified'), false);

  let authCalls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    authCalls += 1;
    assert.equal(init.headers.Authorization, 'Bearer re_test');
    return new Response(JSON.stringify({ name: 'invalid_api_key' }), { status: 401 });
  };
  let denied;
  try {
    denied = await post({ shareId: 'mail-share', recipientEmails: 'a@example.com' }, {
      ...ENV,
      RESEND_API_KEY: ' re_test ',
    });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(authCalls, 1);
  assert.equal(denied.status, 503);
  assert.equal(denied.data.success, false);
  assert.equal(denied.data.reason, 'invalid_api_key');
  assert.equal(JSON.stringify(denied.data).includes('re_test'), false);

  let unavailableCalls = 0;
  const unavailable = await deliverTransferMail(
    ENV,
    prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'a@example.com' }),
    {
      fetchImpl: async () => {
        unavailableCalls += 1;
        return new Response('busy', { status: 503 });
      },
    },
  );
  assert.equal(unavailableCalls, 2);
  assert.equal(unavailable.success, false);
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.reason, 'provider_unavailable');
  assert.equal(unavailable.reason === 'provider_rejected', false);
});

test('malformed input is rejected before a provider call and transport failures stay failures', async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: 'email-x' }), { status: 200 });
  };
  try {
    const missing = await post({ shareId: '', recipientEmails: 'not-an-email' });
    assert.equal(missing.status, 400);
    assert.equal(missing.data.success, false);
    assert.equal(missing.data.code, 'MALFORMED_INPUT');
    assert.equal(missing.data.reason, 'malformed_input');
    assert.equal(JSON.stringify(missing.data).includes('not-an-email'), false);

    const junk = await onRequest({
      request: new Request('https://itransfer.iprudhvi.in/api/send-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.70' },
        body: '{',
      }),
      env: { ...ENV, RATE_LIMITER: allowingLimiter() },
    });
    const junkBody = await junk.json();
    assert.equal(junk.status, 400);
    assert.equal(junkBody.success, false);
    assert.equal(junkBody.code, 'MALFORMED_INPUT');
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }

  const direct = await deliverTransferMail(ENV, { recipients: ['not-an-email'], shareId: 'mail-share' }, {
    fetchImpl: async () => {
      throw new Error('must not send');
    },
  });
  assert.equal(direct.success, false);
  assert.equal(direct.reason, 'malformed_input');

  const transport = emailTransportFailure();
  assert.equal(transport.success, false);
  assert.equal(transport.reason, 'connection_failed');
  const swallowed = interpretSendEmailResponse(false, null);
  assert.equal(swallowed.success, false);
  assert.equal(swallowed.status, 'unavailable');
  const claimed = interpretSendEmailResponse(false, {
    success: true,
    status: 'accepted',
    delivery: 'unconfirmed',
    provider: 'resend',
    dispatchedCount: 1,
  });
  assert.equal(claimed.success, false);
  assert.equal(claimed.status, 'uncertain');
  assert.equal(describeEmailResult(claimed).badge === 'Delivered', false);
  assert.equal(describeEmailResult(claimed).badge === 'Accepted', false);
});

test('transfer retries keep one idempotency key and other event types do not reuse it', async () => {
  const keys = [];
  const fetchImpl = async (_url, init) => {
    keys.push(init.headers['Idempotency-Key']);
    return new Response(JSON.stringify({ id: `email-${keys.length}` }), { status: 200 });
  };
  const transfer = prepareTransferMail(ENV, { shareId: 'mail-share', recipientEmails: 'a@example.com' });
  const again = prepareTransferMail(ENV, {
    shareId: 'mail-share',
    recipientEmails: 'a@example.com',
    message: 'A different note must not create a second transfer send key',
  });
  const confirmation = prepareTransferMail(ENV, {
    shareId: 'mail-share',
    recipientEmails: 'a@example.com',
    eventType: 'sender_confirmation',
  });
  await deliverTransferMail(ENV, transfer, { fetchImpl });
  await deliverTransferMail(ENV, again, { fetchImpl });
  await deliverTransferMail(ENV, confirmation, { fetchImpl });
  assert.equal(keys.length, 3);
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[0], keys[2]);
  assert.match(keys[0], /^[a-f0-9]{64}$/);
});

