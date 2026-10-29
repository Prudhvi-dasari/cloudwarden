import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUpgrade, recommendPlan, reduceUpgrade, UPGRADE_TIMEOUT_MS } from '../src/lib/upgradeFlow.js';

const GB = 1_000_000_000;

test('the plan follows the size of the send', () => {
  assert.equal(recommendPlan(5 * GB), null);
  assert.equal(recommendPlan(20 * GB).code, 'creator_monthly');
  assert.equal(recommendPlan(80 * GB).code, 'pass');
  assert.equal(recommendPlan(180 * GB).code, 'pro_monthly');
  assert.equal(recommendPlan(300 * GB).code, null);
});

test('checkout return never marks the plan active by itself', () => {
  const start = createUpgrade(20 * GB);
  const picked = reduceUpgrade(start, { type: 'pick', plan: start.plan, signedIn: true });
  assert.equal(picked.step, 'checkout');
  const back = reduceUpgrade(picked, { type: 'returned', status: 'pending', now: 1_000 });
  assert.equal(back.step, 'activating');
  assert.notEqual(back.step, 'ready');
  const ready = reduceUpgrade(back, { type: 'entitled' });
  assert.equal(ready.step, 'ready');
});

test('cancel, failure, already paid, and timeout stay distinct', () => {
  const start = createUpgrade(20 * GB);
  assert.equal(reduceUpgrade(start, { type: 'returned', status: 'cancelled' }).step, 'cancelled');
  assert.equal(reduceUpgrade(start, { type: 'returned', status: 'failed' }).step, 'failed');
  assert.equal(reduceUpgrade(start, { type: 'signed_in', alreadyCovers: true }).step, 'ready');
  const waiting = reduceUpgrade(start, { type: 'checkout_started', now: 0 });
  assert.equal(reduceUpgrade(waiting, { type: 'tick', now: UPGRADE_TIMEOUT_MS }).step, 'activating');
  assert.equal(reduceUpgrade(waiting, { type: 'tick', now: UPGRADE_TIMEOUT_MS + 1 }).step, 'timeout');
  assert.equal(reduceUpgrade({ ...waiting, step: 'timeout' }, { type: 'retry', now: 5 }).step, 'activating');
});
