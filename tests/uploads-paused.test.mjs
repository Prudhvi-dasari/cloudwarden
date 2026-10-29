import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleR2Request } from '../functions/lib/r2Engine.js';

const ENV = {
  SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  SUPABASE_URL: 'https://example.supabase.co',
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'ak',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'sk',
  CLOUDFLARE_R2_BUCKET: 'itransfer-storage',
  CLEANUP_SECRET: 'cleanup-test',
  RATE_LIMITER: {
    fetch: async () => new Response(JSON.stringify({ allowed: false }), { status: 200 }),
  },
};

function call(action, env, method = 'POST') {
  return handleR2Request({
    request: new Request(`https://sendtoanyone.test/api/r2?action=${action}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    }),
    env,
  });
}

test('UPLOADS_PAUSED blocks new upload routes and leaves download cleanup paths alone', async () => {
  const paused = { ...ENV, UPLOADS_PAUSED: '1' };
  for (const action of ['open-transfer', 'get-put-url', 'initiate-upload', 'get-part-url', 'get-part-urls']) {
    const blocked = await call(action, paused);
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).code, 'UPLOADS_PAUSED');
  }

  for (const action of ['complete-upload', 'finalize-upload', 'download-url', 'delete-own']) {
    const continued = await call(action, paused);
    const continuedBody = await continued.json();
    assert.notEqual(continuedBody.code, 'UPLOADS_PAUSED', action);
  }

  const health = await call('health', paused, 'GET');
  assert.equal(health.status, 200);

  const cleanup = await call('cleanup', paused);
  const cleanupBody = await cleanup.json();
  assert.notEqual(cleanupBody.code, 'UPLOADS_PAUSED');
  assert.equal(cleanup.status, 401);

  const open = await call('open-transfer', ENV);
  assert.equal(open.status, 429);
  assert.equal((await open.json()).code, 'RATE_LIMITED');

  const ignored = await call('open-transfer', { ...ENV, UPLOADS_PAUSED: '0' });
  assert.equal(ignored.status, 429);
});
