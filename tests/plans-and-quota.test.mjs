import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { entitlementAllows, productIdFor, tierForPlanCode, TIERS } from '../functions/lib/plans.js';
import { sanitizeProductEvent } from '../functions/lib/productEvents.js';

const GB = 1_000_000_000;

test('plan codes map onto tier entitlements and a pass does not upgrade the account', () => {
  assert.equal(tierForPlanCode('monthly'), 'pro');
  assert.equal(tierForPlanCode('yearly'), 'pro');
  assert.equal(tierForPlanCode('pro_yearly'), 'pro');
  assert.equal(tierForPlanCode('creator_monthly'), 'creator');
  assert.equal(tierForPlanCode('studio_monthly'), 'studio');
  assert.equal(tierForPlanCode('pass'), 'pass');

  const pro = entitlementAllows({ status: 'active', planCode: 'monthly' });
  assert.equal(pro.tier, 'pro');
  assert.equal(pro.paid, true);
  assert.equal(pro.transferBytes, 250 * GB);
  assert.equal(pro.storageBytes, 1000 * GB);
  assert.equal(pro.retentionHours, 180 * 24);

  const creator = entitlementAllows({ status: 'active', plan_code: 'creator_monthly' });
  assert.equal(creator.storageBytes, 200 * GB);
  assert.equal(creator.transferBytes, 50 * GB);
  assert.equal(creator.retentionHours, 30 * 24);

  const studio = entitlementAllows({ status: 'active', planCode: 'studio_monthly' });
  assert.equal(studio.storageBytes, TIERS.studio.storageBytes);
  assert.equal(studio.retentionHours, 365 * 24);
  assert.equal(studio.teamReady, true);
  assert.equal(studio.brand, true);

  const blank = entitlementAllows({ status: 'active' });
  assert.equal(blank.tier, 'pro');

  const pass = entitlementAllows({ status: 'active', planCode: 'pass' });
  assert.equal(pass.tier, 'free');
  assert.equal(pass.paid, false);
  assert.equal(pass.transferBytes, 6 * GB);

  const cancelled = entitlementAllows({ status: 'cancelled', planCode: 'pro_monthly' });
  assert.equal(cancelled.paid, false);
});

test('Dodo product ids prefer the tier env and keep the old Pro aliases', () => {
  const env = {
    DODO_PRODUCT_MONTHLY: 'pdt_old_month',
    DODO_PRODUCT_YEARLY: 'pdt_old_year',
    DODO_PRODUCT_CREATOR_MONTHLY: 'pdt_creator',
    DODO_PRODUCT_STUDIO_MONTHLY: 'pdt_studio',
    DODO_PRODUCT_PASS: 'pdt_pass',
  };
  assert.equal(productIdFor(env, 'monthly'), 'pdt_old_month');
  assert.equal(productIdFor(env, 'pro_monthly'), 'pdt_old_month');
  assert.equal(productIdFor(env, 'yearly'), 'pdt_old_year');
  assert.equal(productIdFor(env, 'creator_monthly'), 'pdt_creator');
  assert.equal(productIdFor(env, 'studio_monthly'), 'pdt_studio');
  assert.equal(productIdFor(env, 'pass'), 'pdt_pass');
  assert.equal(productIdFor({ DODO_PRODUCT_PRO_MONTHLY: 'pdt_new', DODO_PRODUCT_MONTHLY: 'pdt_old' }, 'monthly'), 'pdt_new');
});

test('product events reject secrets and keep the activation names', () => {
  assert.equal(sanitizeProductEvent({ event: 'signup', email: 'a@b.c' }).event, 'signup');
  assert.equal(sanitizeProductEvent({ event: 'signup' }).tier, null);
  assert.equal(sanitizeProductEvent({ event: 'quota_hit', tier: 'creator', bytes: 10 }).tier, 'creator');
  assert.equal(sanitizeProductEvent({ event: 'payment_succeeded', tier: 'pass' }).tier, 'pass');
  assert.equal(sanitizeProductEvent({ event: 'password', tier: 'pro' }), null);
});

test('the account quota migration is namespaced and unapplied by this repo', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261029200000_sta_account_quotas.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.sta_product_events/);
  assert.match(sql, /create table if not exists public\.sta_transfer_passes/);
  assert.match(sql, /ACCOUNT_QUOTA/);
  assert.match(sql, /creator_storage constant bigint := 200000000000/);
  assert.match(sql, /pro_storage constant bigint := 1000000000000/);
  assert.match(sql, /studio_storage constant bigint := 3 \* 1000000000000/);
  assert.match(sql, /pass_transfer constant bigint := 100000000000/);
  assert.match(sql, /'creator', 'pro', 'studio'/);
  assert.match(sql, /brand_logo_url/);
  assert.match(sql, /not been applied/);
  assert.doesNotMatch(sql, /platform_limit constant bigint := 1000000000000/);
  assert.doesNotMatch(sql, /public\.groups|public\.expenses|public\.budget|user_profiles|group_posts/);
  assert.doesNotMatch(sql, /drop table/i);
});
