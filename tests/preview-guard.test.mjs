import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest as sendEmail } from '../functions/api/send-email.js';
import { handlePaymentRequest } from '../functions/lib/dodo.js';
import { handleR2Request } from '../functions/lib/r2Engine.js';

const PREVIEW_URL = 'https://phase5.itransfer-app.pages.dev';

function previewEnv(extra = {}) {
  return {
    SUPABASE_URL: 'https://preview-test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'preview-service-role',
    SUPABASE_PUBLISHABLE_KEY: 'preview-publishable',
    CLOUDFLARE_R2_ACCOUNT_ID: 'preview-account',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'preview-access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'preview-secret',
    CLOUDFLARE_R2_BUCKET: 'itransfer-preview',
    APP_URL: PREVIEW_URL,
    CF_PAGES_BRANCH: 'phase5-rate-limit-test',
    CLEANUP_SECRET: 'preview-cleanup-secret',
    RATE_LIMIT_SCOPE: 'preview',
    RATE_LIMITER: {
      fetch: async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
    },
    ...extra,
  };
}

async function r2(url, env, { method = 'GET', body } = {}) {
  const response = await handleR2Request({
    request: new Request(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    }),
    env,
  });
  return { status: response.status, data: await response.json() };
}

test('production hosts keep the existing fallback path', async () => {
  const health = await r2('https://itransfer.iprudhvi.in/api/r2?action=health', {
    CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'ak',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'sk',
  });
  assert.equal(health.status, 200);
  assert.equal(health.data.code, undefined);
  assert.equal(health.data.bucket, 'itransfer-storage');

  const apex = await r2('https://itransfer-app.pages.dev/api/r2?action=health', previewEnv());
  assert.equal(apex.status, 200);
  assert.equal(apex.data.bucket, 'itransfer-preview');

  const productionHash = await r2('https://abc123.itransfer-app.pages.dev/api/r2?action=health', {
    ...previewEnv(),
    CF_PAGES_BRANCH: 'main',
    CLOUDFLARE_R2_BUCKET: 'itransfer-storage',
    SUPABASE_URL: 'https://giyeepztahdbsejsozog.supabase.co',
    APP_URL: 'https://itransfer.iprudhvi.in',
  });
  assert.equal(productionHash.status, 200);
  assert.notEqual(productionHash.data.code, 'PREVIEW_ISOLATION_REQUIRED');
});

test('a Preview host fails closed instead of using production data or storage', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response('[]', { status: 200 });
  };
  try {
    const missing = await r2(`${PREVIEW_URL}/api/r2?action=open-transfer`, { CF_PAGES_BRANCH: 'phase5-rate-limit-test' }, {
      method: 'POST',
      body: { shareId: 'preview1' },
    });
    assert.equal(missing.status, 503);
    assert.equal(missing.data.code, 'PREVIEW_ISOLATION_REQUIRED');
    assert.ok(missing.data.problems.includes('SUPABASE_URL is required on Preview.'));
    assert.ok(missing.data.problems.includes('CLOUDFLARE_R2_BUCKET is required on Preview.'));
    assert.equal(calls.length, 0);

    const productionDatabase = await r2(`${PREVIEW_URL}/api/r2?action=health`, previewEnv({
      SUPABASE_URL: 'https://giyeepztahdbsejsozog.supabase.co',
    }));
    assert.equal(productionDatabase.data.code, 'PREVIEW_ISOLATION_REQUIRED');
    assert.ok(productionDatabase.data.problems.includes('SUPABASE_URL points at production.'));

    const productionBucket = await r2(`${PREVIEW_URL}/api/r2?action=health`, previewEnv({
      CLOUDFLARE_R2_BUCKET: 'itransfer-storage',
    }));
    assert.ok(productionBucket.data.problems.includes('CLOUDFLARE_R2_BUCKET is the production bucket.'));

    const productionLink = await r2(`${PREVIEW_URL}/api/r2?action=health`, previewEnv({
      APP_URL: 'https://itransfer.iprudhvi.in',
    }));
    assert.ok(productionLink.data.problems.includes('APP_URL points at a production host.'));

    const copiedCleanup = await r2(`${PREVIEW_URL}/api/r2?action=cleanup`, previewEnv({
      CLEANUP_SECRET: 'copied-production-secret',
    }), { method: 'POST' });
    assert.equal(copiedCleanup.data.code, 'PREVIEW_ISOLATION_REQUIRED');
    assert.ok(copiedCleanup.data.problems.some((item) => item.startsWith('CLEANUP_SECRET')));

    const sharedLimiter = await r2(`${PREVIEW_URL}/api/r2?action=health`, previewEnv({
      RATE_LIMIT_SCOPE: '',
    }));
    assert.ok(sharedLimiter.data.problems.some((item) => item.includes('RATE_LIMIT_SCOPE')));

    const missingLimiter = await r2(`${PREVIEW_URL}/api/r2?action=open-transfer`, previewEnv({
      RATE_LIMITER: undefined,
    }), { method: 'POST', body: { shareId: 'preview1' } });
    assert.equal(missingLimiter.status, 503);
    assert.equal(missingLimiter.data.code, 'PREVIEW_ISOLATION_REQUIRED');
    assert.ok(missingLimiter.data.problems.includes('RATE_LIMITER binding is required on Preview.'));

    const emptyCleanup = await r2(`${PREVIEW_URL}/api/r2?action=cleanup`, previewEnv({
      CLEANUP_SECRET: '',
    }), { method: 'POST' });
    assert.equal(emptyCleanup.data.code, 'PREVIEW_ISOLATION_REQUIRED');
    assert.ok(emptyCleanup.data.problems.some((item) => item.startsWith('CLEANUP_SECRET')));

    const branchAlias = await r2('https://phase5-rate-limit-test.itransfer-app.pages.dev/api/r2?action=health', previewEnv({
      SUPABASE_URL: 'https://giyeepztahdbsejsozog.supabase.co',
    }));
    assert.equal(branchAlias.status, 503);
    assert.equal(branchAlias.data.code, 'PREVIEW_ISOLATION_REQUIRED');

    const deploymentUrl = await r2('https://deadbeef.itransfer-app.pages.dev/api/r2?action=health', previewEnv({
      CF_PAGES_BRANCH: 'phase5-rate-limit-test',
      SUPABASE_URL: 'https://giyeepztahdbsejsozog.supabase.co',
      CLOUDFLARE_R2_BUCKET: 'itransfer-storage',
      APP_URL: 'https://itransfer.iprudhvi.in',
    }));
    assert.equal(deploymentUrl.status, 503);
    assert.equal(deploymentUrl.data.code, 'PREVIEW_ISOLATION_REQUIRED');
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('an isolated Preview configuration can answer health without the production bucket', async () => {
  const health = await r2(`${PREVIEW_URL}/api/r2?action=health`, previewEnv());
  assert.equal(health.status, 200);
  assert.equal(health.data.bucket, 'itransfer-preview');
  assert.equal(health.data.configured, true);
});

test('Preview email does not call Resend unless every recipient is on the allowlist', async () => {
  const original = globalThis.fetch;
  const resendCalls = [];
  globalThis.fetch = async (url) => {
    resendCalls.push(String(url));
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
  };
  const send = (env, recipientEmails) => {
    const request = new Request(`${PREVIEW_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.40' },
      body: JSON.stringify({ shareId: 'preview-mail', recipientEmails }),
    });
    return sendEmail({ request, env }).then(async (response) => ({
      status: response.status,
      data: await response.json(),
    }));
  };
  try {
    const blockedConfig = await send(previewEnv({
      RESEND_API_KEY: 're_preview_test',
      RATE_LIMIT_SCOPE: '',
    }), 'person@example.com');
    assert.equal(blockedConfig.status, 503);
    assert.equal(blockedConfig.data.code, 'PREVIEW_ISOLATION_REQUIRED');
    assert.equal(resendCalls.length, 0);

    const disabled = await send(previewEnv({ RESEND_API_KEY: 're_preview_test' }), 'person@example.com');
    assert.equal(disabled.status, 200);
    assert.equal(disabled.data.reason, 'preview_email_disabled');
    assert.equal(resendCalls.length, 0);

    const foreign = await send(previewEnv({
      RESEND_API_KEY: 're_preview_test',
      PREVIEW_EMAIL_MODE: 'allowlist',
      PREVIEW_EMAIL_ALLOWLIST: 'qa@example.com',
      RATE_LIMIT_SCOPE: 'preview',
      RATE_LIMITER: {
        fetch: async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
      },
    }), 'person@example.com');
    assert.equal(foreign.data.reason, 'preview_email_disabled');
    assert.equal(resendCalls.length, 0);

    const allowed = await send(previewEnv({
      RESEND_API_KEY: 're_preview_test',
      PREVIEW_EMAIL_MODE: 'allowlist',
      PREVIEW_EMAIL_ALLOWLIST: 'qa@example.com',
      RATE_LIMIT_SCOPE: 'preview',
      RATE_LIMITER: {
        fetch: async () => new Response(JSON.stringify({ allowed: true }), { status: 200 }),
      },
    }), 'qa@example.com');
    assert.equal(allowed.data.status, 'accepted');
    assert.equal(resendCalls.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('Preview payment health is refused when the Preview configuration points at production', async () => {
  const response = await handlePaymentRequest({
    request: new Request(`${PREVIEW_URL}/api/payment?action=health`),
    env: previewEnv({ SUPABASE_URL: 'https://giyeepztahdbsejsozog.supabase.co' }),
  });
  const data = await response.json();
  assert.equal(response.status, 503);
  assert.equal(data.code, 'PREVIEW_ISOLATION_REQUIRED');
});
