import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutAccessToken, readStoredAccessToken } from '../src/lib/checkoutSession.js';

function storage(entries) {
  const values = new Map(Object.entries(entries));
  return { getItem: (key) => (values.has(key) ? values.get(key) : null) };
}

test('checkout reads a stored access token without waiting on getSession', async () => {
  const memory = storage({
    'sb-giyeepztahdbsejsozog-auth-token': JSON.stringify({ access_token: 'stored-token' }),
  });
  assert.equal(readStoredAccessToken(memory), 'stored-token');
  const previous = globalThis.localStorage;
  globalThis.localStorage = memory;
  let called = false;
  try {
    const resolved = await checkoutAccessToken(() => {
      called = true;
      return new Promise(() => {});
    });
    assert.equal(resolved, 'stored-token');
    assert.equal(called, false);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('checkout stops waiting when getSession never returns', async () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = storage({});
  try {
    const started = Date.now();
    const token = await checkoutAccessToken(() => new Promise(() => {}), { timeoutMs: 30 });
    assert.equal(token, '');
    assert.ok(Date.now() - started < 500);
  } finally {
    globalThis.localStorage = previous;
  }
});
