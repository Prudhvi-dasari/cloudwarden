import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handlePaymentRequest, transferAllowance } from '../functions/lib/dodo.js';
import { decideBillingEvent, processDodoEvent, signDodoWebhook } from '../functions/lib/dodoWebhook.js';
import { entitlementAllows } from '../functions/lib/plans.js';
import { STORAGE_POLICY } from '../functions/lib/storagePolicy.js';
import { checkoutReturnState } from '../src/lib/checkoutReturn.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const secretBytes = new Uint8Array(24);
for (let i = 0; i < secretBytes.length; i += 1) secretBytes[i] = i + 1;
const WEBHOOK_SECRET = `whsec_${Buffer.from(secretBytes).toString('base64')}`;

function baseEnv(extra = {}) {
  return {
    SUPABASE_URL: 'https://billing.test',
    SUPABASE_PUBLISHABLE_KEY: 'publishable-test',
    DODO_API_KEY: 'test_dodo_key',
    DODO_CHECKOUT_ENABLED: 'true',
    DODO_PRODUCT_MONTHLY: 'pdt_month',
    DODO_PRODUCT_YEARLY: 'pdt_year',
    DODO_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ...extra,
  };
}

function memoryStore(seed = []) {
  const events = new Map();
  const entitlements = new Map(seed);
  return {
    events,
    entitlements,
    writes: 0,
    async insertEventIfNew(id, decision) {
      if (events.has(id)) return false;
      events.set(id, decision);
      return true;
    },
    async deleteEvent(id) {
      events.delete(id);
    },
    async upsertEntitlement(decision) {
      this.writes += 1;
      entitlements.set(decision.userId, { ...decision });
    },
  };
}

function installFetch({ user = { id: USER_A, email: 'payer@example.com' }, dodo } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    calls.push({ href, options });
    if (href.endsWith('/auth/v1/user')) {
      const auth = options.headers?.Authorization || options.headers?.authorization || '';
      if (auth !== 'Bearer session-token') return new Response('{}', { status: 401 });
      if (!user) return new Response('{}', { status: 401 });
      return new Response(JSON.stringify(user), { status: 200 });
    }
    if (href.startsWith('https://test.dodopayments.com/checkouts') || href.startsWith('https://live.dodopayments.com/checkouts')) {
      if (dodo) return dodo(href, options);
      return new Response(JSON.stringify({
        session_id: 'cks_test',
        checkout_url: 'https://test.checkout.dodopayments.com/session/cks_test',
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'unexpected fetch' }), { status: 500 });
  };
  return {
    calls,
    restore() { globalThis.fetch = original; },
  };
}

async function postCheckout(env, { token = 'session-token', body = { plan: 'monthly' }, cookie = '', country = '' } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  if (country) headers['cf-ipcountry'] = country;
  const response = await handlePaymentRequest({
    request: new Request('https://sendtoanyone.com/api/payment?action=checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    env,
  });
  return { status: response.status, data: await response.json() };
}

async function signedWebhook(env, event, { id = 'msg_1', timestamp = Math.floor(Date.now() / 1000), mutate } = {}) {
  const raw = JSON.stringify(event);
  const signature = await signDodoWebhook(raw, { id, timestamp, secret: env.DODO_WEBHOOK_SECRET });
  const response = await handlePaymentRequest({
    request: new Request('https://sendtoanyone.com/api/payment?action=webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'webhook-id': id,
        'webhook-timestamp': String(timestamp),
        'webhook-signature': mutate ? signature.replace('v1,', 'v1,x') : signature,
      },
      body: raw,
    }),
    env,
  });
  return { status: response.status, data: await response.json(), raw };
}

function paymentEvent(type, { userId = USER_A, plan = 'monthly', productId = 'pdt_month', paymentId = 'pay_1', subscriptionId = '', omitPlan = false } = {}) {
  const metadata = { user_id: userId };
  if (!omitPlan) metadata.plan_code = plan;
  return {
    business_id: 'bus_test',
    type,
    timestamp: new Date().toISOString(),
    data: {
      payload_type: type.startsWith('subscription') ? 'Subscription' : 'Payment',
      payment_id: paymentId,
      subscription_id: subscriptionId,
      product_id: productId,
      metadata,
    },
  };
}

test('authenticated checkout uses the server product and test mode', async () => {
  const network = installFetch();
  try {
    const result = await postCheckout(baseEnv(), { cookie: 'ml_vid=visitor-1; ml_sid=session-1' });
    assert.equal(result.status, 200);
    assert.equal(result.data.checkoutUrl, 'https://test.checkout.dodopayments.com/session/cks_test');
    assert.equal(result.data.sessionId, 'cks_test');
    assert.equal(JSON.stringify(result.data).includes('test_dodo_key'), false);
    const dodoCall = network.calls.find((call) => call.href.includes('/checkouts'));
    assert.equal(dodoCall.href, 'https://test.dodopayments.com/checkouts');
    assert.equal(dodoCall.options.headers.Authorization, 'Bearer test_dodo_key');
    const payload = JSON.parse(dodoCall.options.body);
    assert.deepEqual(payload.product_cart, [{ product_id: 'pdt_month', quantity: 1 }]);
    assert.equal(payload.metadata.user_id, USER_A);
    assert.equal(payload.metadata.plan_code, 'pro_monthly');
    assert.equal(payload.metadata.ml_visitor_id, 'visitor-1');
    assert.equal(payload.metadata.ml_session_id, 'session-1');
    assert.equal(payload.metadata.email, 'payer@example.com');
    assert.equal(payload.return_url, 'https://sendtoanyone.com/pricing?checkout=return');
    assert.equal(payload.price, undefined);
    assert.equal(payload.amount, undefined);
  } finally {
    network.restore();
  }
});

test('checkout rejects missing auth, unknown plans, client product ids, and missing configuration', async () => {
  const network = installFetch();
  try {
    const anonymous = await postCheckout(baseEnv(), { token: '' });
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.data.code, 'AUTH_REQUIRED');

    const invalidUser = await postCheckout(baseEnv(), { token: 'bad' });
    assert.equal(invalidUser.status, 401);
    assert.equal(invalidUser.data.code, 'AUTH_REQUIRED');

    const unknown = await postCheckout(baseEnv(), { body: { plan: 'teams', product_id: 'pdt_other' } });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.data.code, 'PRODUCT_NOT_ALLOWED');

    const unknownPlan = await postCheckout(baseEnv(), { body: { plan: 'teams' } });
    assert.equal(unknownPlan.status, 400);
    assert.equal(unknownPlan.data.code, 'UNKNOWN_PLAN');

    const priced = await postCheckout(baseEnv(), { body: { plan: 'monthly', amount: 1 } });
    assert.equal(priced.status, 400);

    const { DODO_PRODUCT_MONTHLY, ...withoutProduct } = baseEnv();
    const missing = await postCheckout(withoutProduct);
    assert.equal(missing.status, 503);
    assert.equal(missing.data.code, 'PRODUCT_UNCONFIGURED');
    assert.equal(DODO_PRODUCT_MONTHLY, 'pdt_month');

    const { SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY, ...withoutPublishable } = baseEnv();
    const fallbackAuth = await postCheckout(withoutPublishable);
    assert.equal(fallbackAuth.status, 200);
    assert.equal(SUPABASE_PUBLISHABLE_KEY, 'publishable-test');
    assert.equal(SUPABASE_ANON_KEY, undefined);

    const { DODO_CHECKOUT_ENABLED, ...closed } = baseEnv();
    const disabled = await postCheckout(closed);
    assert.equal(disabled.status, 503);
    assert.equal(disabled.data.code, 'CHECKOUT_DISABLED');
    assert.equal(DODO_CHECKOUT_ENABLED, 'true');
    const closedOffers = await handlePaymentRequest({
      request: new Request('https://sendtoanyone.com/api/payment?action=offers'),
      env: closed,
    });
    const closedBody = await closedOffers.json();
    assert.equal(closedBody.purchasable, false);

    const offers = await handlePaymentRequest({
      request: new Request('https://sendtoanyone.com/api/payment?action=offers'),
      env: baseEnv(),
    });
    const offerBody = await offers.json();
    assert.equal(offerBody.purchasable, true);
    assert.equal(offerBody.plans.find((plan) => plan.code === 'monthly').purchasable, true);
    assert.equal(offerBody.currency, 'USD');
    assert.equal(offerBody.plans.find((plan) => plan.code === 'yearly').priceLabel, '$150');
    assert.equal(offerBody.plans.find((plan) => plan.code === 'yearly').inrLabel, '₹7,999');
    assert.equal(offerBody.plans.find((plan) => plan.code === 'yearly').usdLabel, '$150');
    assert.equal(offerBody.mode, 'test');
    assert.equal(JSON.stringify(offerBody).includes('pdt_month'), false);
    assert.equal(offerBody.checkoutUrl, undefined);
    assert.equal(network.calls.some((call) => call.href.includes('/checkouts')), true);
  } finally {
    network.restore();
  }
});

test('a hung or rejected Dodo call returns an error instead of waiting', async () => {
  const hung = installFetch({ dodo: () => { throw new Error('aborted'); } });
  try {
    const result = await postCheckout(baseEnv());
    assert.equal(result.status, 502);
    assert.equal(result.data.code, 'CHECKOUT_TIMEOUT');
  } finally {
    hung.restore();
  }

  const rejected = installFetch({
    dodo: () => new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401 }),
  });
  try {
    const result = await postCheckout(baseEnv());
    assert.equal(result.status, 502);
    assert.equal(result.data.code, 'CHECKOUT_FAILED');
    assert.equal(result.data.error, 'Dodo rejected the payment key, so checkout cannot open.');
    assert.equal(JSON.stringify(result.data).includes('unauthorized'), false);
  } finally {
    rejected.restore();
  }
});

test('a hyphen inside the webhook secret still verifies', async () => {
  const store = memoryStore();
  const body = WEBHOOK_SECRET.slice('whsec_'.length);
  const env = baseEnv({
    DODO_WEBHOOK_SECRET: `whsec_${body.slice(0, 8)}-${body.slice(8)}`,
    billingStore: store,
  });
  const raw = JSON.stringify({
    type: 'payment.succeeded',
    data: { metadata: {}, product_cart: [{ product_id: 'pdt_sample', quantity: 1 }] },
  });
  const id = 'msg_hyphen';
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signDodoWebhook(raw, { id, timestamp, secret: WEBHOOK_SECRET });
  const response = await handlePaymentRequest({
    request: new Request('https://sendtoanyone.com/api/payment?action=webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'webhook-id': id,
        'webhook-timestamp': String(timestamp),
        'webhook-signature': signature,
      },
      body: raw,
    }),
    env,
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.received, true);
  assert.equal(store.writes, 0);
});

test('invalid, duplicate, and lifecycle webhooks update only the matching user', async () => {
  const store = memoryStore([[USER_B, { userId: USER_B, status: 'active', planCode: 'yearly' }]]);
  const env = baseEnv({ billingStore: store });

  const bad = await signedWebhook(env, paymentEvent('payment.succeeded'), { mutate: true });
  assert.equal(bad.status, 401);
  assert.equal(bad.data.code, 'WEBHOOK_SIGNATURE');
  assert.equal(store.entitlements.get(USER_A), undefined);

  const stale = await signedWebhook(env, paymentEvent('payment.succeeded'), {
    id: 'msg_stale',
    timestamp: Math.floor(Date.now() / 1000) - 600,
  });
  assert.equal(stale.status, 401);

  const paid = await signedWebhook(env, paymentEvent('payment.succeeded', { subscriptionId: 'sub_1' }), { id: 'msg_paid' });
  assert.equal(paid.status, 200);
  assert.equal(paid.data.duplicate, false);
  assert.equal(store.entitlements.get(USER_A).status, 'active');
  assert.equal(store.entitlements.get(USER_A).planCode, 'monthly');
  assert.equal(store.entitlements.get(USER_B).status, 'active');
  assert.equal(store.entitlements.get(USER_B).planCode, 'yearly');

  const again = await signedWebhook(env, paymentEvent('payment.succeeded'), { id: 'msg_paid' });
  assert.equal(again.status, 200);
  assert.equal(again.data.duplicate, true);
  assert.equal(store.writes, 1);

  const foreignProduct = await processDodoEvent({
    event: paymentEvent('payment.succeeded', { productId: 'pdt_other' }),
    webhookId: 'msg_foreign',
    store,
    products: { monthly: 'pdt_month', yearly: 'pdt_year' },
  });
  assert.equal(foreignProduct.decision.apply, false);
  assert.equal(store.writes, 1);

  for (const [type, status, id] of [
    ['payment.failed', 'failed', 'msg_failed'],
    ['subscription.cancelled', 'cancelled', 'msg_cancel'],
    ['subscription.expired', 'expired', 'msg_expire'],
  ]) {
    const result = await signedWebhook(env, paymentEvent(type), { id });
    assert.equal(result.status, 200, type);
    assert.equal(store.entitlements.get(USER_A).status, status, type);
    assert.equal(store.entitlements.get(USER_B).planCode, 'yearly');
  }

  const renewed = await signedWebhook(env, paymentEvent('subscription.renewed', { subscriptionId: 'sub_1' }), { id: 'msg_renew' });
  assert.equal(renewed.status, 200);
  assert.equal(store.entitlements.get(USER_A).status, 'active');

  const allowance = transferAllowance(store.entitlements.get(USER_A));
  assert.equal(allowance.bytes, STORAGE_POLICY.paidTransferBytes);
  assert.equal(allowance.bytes, 250_000_000_000);
  assert.equal(allowance.hours, 180 * 24);
  const freeAllowance = transferAllowance(null);
  assert.equal(freeAllowance.bytes, 6_000_000_000);
  assert.equal(freeAllowance.hours, 168);
  assert.equal(allowance.paidFeaturesEnabled, true);
  assert.equal(STORAGE_POLICY.paidFeaturesEnabled, true);
});

test('a payment with only the customer email links to that account', async () => {
  const store = memoryStore();
  store.userIdForEmail = async (email) => (email === 'payer@example.com' ? USER_A : '');
  const event = {
    type: 'payment.succeeded',
    data: {
      payload: {
        payment_id: 'pay_email',
        customer: { email: 'Payer@Example.com' },
        product_cart: [{ product_id: 'pdt_month', quantity: 1 }],
      },
    },
  };
  const unmatched = decideBillingEvent(event, { monthly: 'pdt_month', yearly: 'pdt_year' });
  assert.equal(unmatched.outcome, 'unmatched_user');
  assert.equal(unmatched.customerEmail, 'payer@example.com');
  assert.equal(unmatched.planCode, 'monthly');

  const result = await processDodoEvent({
    event,
    webhookId: 'msg_email',
    store,
    products: { monthly: 'pdt_month', yearly: 'pdt_year' },
  });
  assert.equal(result.decision.apply, true);
  assert.equal(result.decision.userId, USER_A);
  assert.equal(store.entitlements.get(USER_A).status, 'active');
  assert.equal(store.entitlements.get(USER_A).paymentId, 'pay_email');

  const planOnly = decideBillingEvent({
    type: 'payment.succeeded',
    data: { metadata: { user_id: USER_A, plan_code: 'yearly' }, payment_id: 'pay_plan' },
  }, { monthly: 'pdt_month', yearly: 'pdt_year' });
  assert.equal(planOnly.apply, true);
  assert.equal(planOnly.planCode, 'yearly');

  const renewed = decideBillingEvent({
    type: 'subscription.renewed',
    data: { subscription_id: 'sub_9', metadata: { user_id: USER_A, plan_code: 'monthly' }, product_id: 'pdt_month' },
  }, { monthly: 'pdt_month', yearly: 'pdt_year' });
  assert.equal(renewed.status, 'active');
  assert.equal(renewed.apply, true);

  const failed = decideBillingEvent({
    type: 'payment.failed',
    data: { metadata: { user_id: USER_A, plan_code: 'monthly' }, product_id: 'pdt_month' },
  }, { monthly: 'pdt_month', yearly: 'pdt_year' });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.apply, true);

  const sql = readFileSync(new URL('../supabase/migrations/20261029180000_billing_apply_and_reconcile.sql', import.meta.url), 'utf8');
  assert.match(sql, /itransfer\.billing_write/);
  assert.match(sql, /reconcile_billing_by_email/);
  assert.match(sql, /revoke all on function public\.reconcile_billing_by_email/);
  assert.doesNotMatch(sql, /reserve_transfer_file/);
});

test('a checkout return never confirms payment, and the migration is additive', () => {
  const succeeded = checkoutReturnState({ payment_id: 'pay_1', status: 'succeeded', checkout: 'return' });
  assert.equal(succeeded.confirmed, false);
  assert.equal(succeeded.tone, 'pending');
  const failed = checkoutReturnState({ status: 'failed', payment_id: 'pay_1' });
  assert.equal(failed.confirmed, false);
  assert.equal(failed.tone, 'failed');
  const cancelled = checkoutReturnState({ status: 'cancelled', subscription_id: 'sub_1' });
  assert.equal(cancelled.tone, 'cancelled');
  assert.equal(checkoutReturnState({}), null);

  const sql = readFileSync(new URL('../supabase/migrations/20261027131500_billing_entitlements.sql', import.meta.url), 'utf8');
  const executable = sql.replace(/--.*$/gm, '');
  assert.match(executable, /create table if not exists public\.billing_events/);
  assert.match(executable, /create table if not exists public\.billing_entitlements/);
  assert.doesNotMatch(executable, /reserve_transfer_file|drop table|public\.transfers/i);
  const engine = readFileSync(new URL('../functions/lib/r2Engine.js', import.meta.url), 'utf8');
  assert.equal(engine.includes('userPlan'), false);
});

test('checkout currency follows the connection country and ignores a client currency', async () => {
  const env = baseEnv({
    DODO_PRODUCT_CREATOR_MONTHLY: 'pdt_0NqoDtsIq58zQ2ukjCex2',
    DODO_PRODUCT_CREATOR_MONTHLY_USD: 'pdt_creator_usd',
    DODO_PRODUCT_PRO_YEARLY: 'pdt_year_inr',
    DODO_PRODUCT_PRO_YEARLY_USD: 'pdt_year_usd',
  });
  const network = installFetch();
  try {
    const gamed = await postCheckout(env, {
      country: 'US',
      body: { plan: 'creator_monthly', currency: 'INR', billing_currency: 'INR' },
    });
    assert.equal(gamed.status, 200);
    const usPayload = JSON.parse(network.calls.find((call) => call.href.includes('/checkouts')).options.body);
    assert.deepEqual(usPayload.product_cart, [{ product_id: 'pdt_creator_usd', quantity: 1 }]);
    assert.equal(usPayload.billing_currency, 'USD');
    assert.deepEqual(usPayload.billing_address, { country: 'US' });
    assert.equal(usPayload.feature_flags.allow_currency_selection, false);
    assert.equal(usPayload.feature_flags.allow_customer_editing_country, false);
    assert.equal(usPayload.metadata.plan_code, 'creator_monthly');
    assert.equal(usPayload.metadata.currency, 'USD');
    assert.equal(usPayload.metadata.country, 'US');

    const india = await postCheckout(env, {
      country: 'IN',
      body: { plan: 'creator_monthly', currency: 'USD' },
    });
    assert.equal(india.status, 200);
    const inPayload = JSON.parse(network.calls.filter((call) => call.href.includes('/checkouts')).at(-1).options.body);
    assert.deepEqual(inPayload.product_cart, [{ product_id: 'pdt_0NqoDtsIq58zQ2ukjCex2', quantity: 1 }]);
    assert.equal(inPayload.billing_currency, 'INR');
    assert.deepEqual(inPayload.billing_address, { country: 'IN' });
    assert.equal(inPayload.metadata.plan_code, 'creator_monthly');

    const fallback = await postCheckout(baseEnv({ DODO_PRODUCT_PASS: 'pdt_pass_inr' }), {
      country: 'DE',
      body: { plan: 'pass' },
    });
    assert.equal(fallback.status, 200);
    const fallbackPayload = JSON.parse(network.calls.filter((call) => call.href.includes('/checkouts')).at(-1).options.body);
    assert.equal(fallbackPayload.product_cart[0].product_id, 'pdt_pass_inr');
    assert.equal(fallbackPayload.billing_currency, 'INR');
    assert.equal(fallbackPayload.billing_address.country, 'DE');

    const usOffers = await handlePaymentRequest({
      request: new Request('https://sendtoanyone.com/api/payment?action=offers', { headers: { 'cf-ipcountry': 'US' } }),
      env,
    });
    const usBody = await usOffers.json();
    assert.equal(usBody.currency, 'USD');
    assert.equal(usBody.country, 'US');
    assert.equal(usBody.plans.find((plan) => plan.code === 'creator_monthly').priceLabel, '$5');
    assert.equal(usBody.plans.find((plan) => plan.code === 'creator_monthly').chargeCurrency, 'USD');
    assert.equal(JSON.stringify(usBody).includes('pdt_creator_usd'), false);

    const inOffers = await handlePaymentRequest({
      request: new Request('https://sendtoanyone.com/api/payment?action=offers', { headers: { 'cf-ipcountry': 'IN' } }),
      env,
    });
    const inBody = await inOffers.json();
    assert.equal(inBody.currency, 'INR');
    assert.equal(inBody.plans.find((plan) => plan.code === 'pro_yearly').priceLabel, '₹7,999');
    assert.equal(inBody.plans.find((plan) => plan.code === 'studio_monthly').priceLabel, '₹2,499');
    assert.equal(inBody.plans.find((plan) => plan.code === 'pass').priceLabel, '₹149');

    const cfRequest = new Request('https://sendtoanyone.com/api/payment?action=offers', {
      headers: { 'cf-ipcountry': 'US' },
    });
    cfRequest.cf = { country: 'IN' };
    const cfWins = await handlePaymentRequest({ request: cfRequest, env });
    assert.equal((await cfWins.json()).currency, 'INR');
  } finally {
    network.restore();
  }
});

test('creator INR and USD webhooks call apply_billing_entitlement and grant the creator quota', async () => {
  const rpc = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('/rpc/apply_billing_entitlement')) {
      rpc.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ ok: true, tier: 'creator', status: 'active' }), { status: 200 });
    }
    if (href.includes('/rest/v1/billing_events') && (!options.method || options.method === 'GET')) {
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: 201 });
  };
  const env = baseEnv({
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    DODO_PRODUCT_CREATOR_MONTHLY: 'pdt_0NqoDtsIq58zQ2ukjCex2',
    DODO_PRODUCT_CREATOR_MONTHLY_USD: 'pdt_creator_usd',
  });
  try {
    const paid = await signedWebhook(env, paymentEvent('payment.succeeded', {
      plan: 'creator_monthly',
      productId: 'pdt_0NqoDtsIq58zQ2ukjCex2',
      paymentId: 'pay_creator_inr',
    }), { id: 'msg_creator_inr' });
    assert.equal(paid.status, 200);
    assert.equal(paid.data.duplicate, false);

    const renewed = await signedWebhook(env, paymentEvent('subscription.active', {
      omitPlan: true,
      productId: 'pdt_creator_usd',
      paymentId: 'pay_creator_usd',
      subscriptionId: 'sub_creator_usd',
    }), { id: 'msg_creator_usd' });
    assert.equal(renewed.status, 200);
    assert.equal(renewed.data.duplicate, false);
  } finally {
    globalThis.fetch = original;
  }

  assert.equal(rpc.length, 2);
  assert.equal(rpc[0].p_user_id, USER_A);
  assert.equal(rpc[0].p_plan_code, 'creator_monthly');
  assert.equal(rpc[0].p_status, 'active');
  assert.equal(rpc[0].p_payment_id, 'pay_creator_inr');
  assert.equal(rpc[1].p_plan_code, 'creator_monthly');
  assert.equal(rpc[1].p_status, 'active');
  assert.equal(rpc[1].p_subscription_id, 'sub_creator_usd');

  const creator = entitlementAllows({ status: 'active', planCode: rpc[0].p_plan_code });
  assert.equal(creator.tier, 'creator');
  assert.equal(creator.paid, true);
  assert.equal(creator.storageBytes, 200_000_000_000);
  assert.equal(creator.transferBytes, 50_000_000_000);
  assert.equal(creator.retentionHours, 30 * 24);

  const sql = readFileSync(new URL('../supabase/migrations/20261029200000_sta_account_quotas.sql', import.meta.url), 'utf8');
  assert.match(sql, /when p_plan_code in \('creator_monthly', 'creator'\) then 'creator'/);
  assert.match(sql, /creator_storage constant bigint := 200000000000/);
  assert.match(sql, /creator_transfer constant bigint := 50000000000/);
  assert.match(sql, /max_hours := 720/);
  assert.match(sql, /perform public\.apply_billing_entitlement|return public\.apply_billing_entitlement|rpc\/apply_billing_entitlement|create or replace function public\.apply_billing_entitlement/);
});
