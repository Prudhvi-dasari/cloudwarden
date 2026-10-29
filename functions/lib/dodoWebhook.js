import { timingSafeEqual } from './transferSecurity.js';
import { configuredProductIds, isPlanCode, planCodeForProduct, productMap, tierForPlanCode } from './plans.js';
import { recordProductEvent } from './productEvents.js';

const encoder = new TextEncoder();
const TOLERANCE_MS = 5 * 60 * 1000;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTIVATE = new Set(['payment.succeeded', 'subscription.active', 'subscription.renewed']);
const FAIL = new Set(['payment.failed', 'subscription.failed']);
const CANCEL = new Set(['payment.cancelled', 'subscription.cancelled']);
const EXPIRE = new Set(['subscription.expired', 'subscription.on_hold']);
const PENDING = new Set(['payment.processing']);

function envGet(env, key) {
  if (env && env[key]) return env[key];
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  return '';
}

export { productMap };

function bytesToBase64(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function base64ToBytes(value) {
  // Standard Webhooks decodes with the base64 alphabet and ignores other characters.
  const stripped = String(value).replace(/[^A-Za-z0-9+/=]/g, '').replace(/=+$/, '');
  const padded = stripped + '='.repeat((4 - (stripped.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importWebhookKey(secret) {
  const trimmed = String(secret || '').trim();
  const encoded = trimmed.startsWith('whsec_') ? trimmed.slice('whsec_'.length) : trimmed;
  if (!encoded) throw new Error('missing webhook secret');
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(encoded),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function signDodoWebhook(rawBody, { id, timestamp, secret }) {
  const key = await importWebhookKey(secret);
  const signed = `${id}.${timestamp}.${rawBody}`;
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signed));
  return `v1,${bytesToBase64(new Uint8Array(mac))}`;
}

export async function verifyDodoWebhook(rawBody, headers, secret, nowMs = Date.now()) {
  const id = headers.get('webhook-id') || '';
  const timestamp = headers.get('webhook-timestamp') || '';
  const signature = headers.get('webhook-signature') || '';
  if (!id || !timestamp || !signature || !secret) throw new Error('missing webhook signature');
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) throw new Error('invalid webhook timestamp');
  if (Math.abs(nowMs - seconds * 1000) > TOLERANCE_MS) throw new Error('expired webhook timestamp');
  const expected = (await signDodoWebhook(rawBody, { id, timestamp, secret })).slice(3);
  const presented = signature.split(' ').filter((part) => part.startsWith('v1,')).map((part) => part.slice(3));
  if (!presented.some((candidate) => timingSafeEqual(candidate, expected))) {
    throw new Error('invalid webhook signature');
  }
}

function eventRecord(event) {
  const data = event?.data && typeof event.data === 'object' && !Array.isArray(event.data) ? event.data : {};
  if (data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) return data.payload;
  if (data.object && typeof data.object === 'object' && !Array.isArray(data.object)) return data.object;
  return data;
}

function cartProductId(cart) {
  const items = Array.isArray(cart) ? cart : [];
  const first = items.find((item) => typeof item?.product_id === 'string' && item.product_id);
  return first?.product_id || '';
}

function eventProductId(data) {
  if (typeof data?.product_id === 'string' && data.product_id) return data.product_id;
  const direct = cartProductId(data?.product_cart)
    || cartProductId(data?.checkout?.product_cart)
    || cartProductId(data?.payment?.product_cart);
  if (direct) return direct;
  const nested = [data?.product, data?.subscription, data?.payment].find((item) => typeof item?.product_id === 'string' && item.product_id);
  return nested?.product_id || '';
}

function customerEmail(data, metadata) {
  const candidates = [metadata.email, data?.customer?.email, data?.customer_email, data?.billing?.email];
  for (const value of candidates) {
    if (typeof value === 'string' && value.includes('@') && value.length <= 320) return value.trim().toLowerCase();
  }
  return '';
}

function statusFor(type) {
  if (ACTIVATE.has(type)) return 'active';
  if (FAIL.has(type)) return 'failed';
  if (CANCEL.has(type)) return 'cancelled';
  if (EXPIRE.has(type)) return 'expired';
  if (PENDING.has(type)) return 'pending';
  return '';
}

export function decideBillingEvent(event, products, overrides = {}) {
  const type = typeof event?.type === 'string' ? event.type : '';
  const data = eventRecord(event);
  const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {};
  const metadataUser = typeof metadata.user_id === 'string' ? metadata.user_id : (typeof metadata.userId === 'string' ? metadata.userId : '');
  const overrideUser = typeof overrides.userId === 'string' ? overrides.userId : '';
  const userId = USER_ID.test(overrideUser) ? overrideUser : metadataUser;
  const productId = eventProductId(data) || (typeof metadata.product_id === 'string' ? metadata.product_id : '');
  const configuredPlan = planCodeForProduct(products, productId);
  const metaPlan = isPlanCode(metadata.plan_code) ? metadata.plan_code : '';
  const plan = metaPlan || configuredPlan;
  const knownIds = configuredProductIds(products, plan);
  const productMatches = productId ? knownIds.includes(productId) : knownIds.length > 0;
  const status = statusFor(type);
  const base = {
    eventType: type,
    userId: USER_ID.test(userId) ? userId : '',
    customerEmail: customerEmail(data, metadata),
    planCode: plan,
    status,
    paymentId: typeof data.payment_id === 'string' ? data.payment_id : '',
    subscriptionId: typeof data.subscription_id === 'string' ? data.subscription_id : '',
    apply: false,
  };
  if (!status) return { ...base, outcome: 'ignored' };
  if (!base.userId) return { ...base, outcome: 'unmatched_user' };
  if (status === 'active' && !productMatches) return { ...base, outcome: 'unmapped_product' };
  if (productId && !productMatches) return { ...base, outcome: 'unmapped_product' };
  if (!plan || knownIds.length === 0) return { ...base, outcome: 'unmapped_product' };
  return { ...base, outcome: status, apply: true };
}

export async function processDodoEvent({ event, webhookId, store, products }) {
  let decision = decideBillingEvent(event, products);
  if (!decision.userId && decision.customerEmail && typeof store.userIdForEmail === 'function') {
    const resolved = await store.userIdForEmail(decision.customerEmail);
    if (resolved) decision = decideBillingEvent(event, products, { userId: resolved });
  }
  const fresh = await store.insertEventIfNew(webhookId, decision);
  if (!fresh) return { duplicate: true, decision };
  try {
    if (decision.apply) await store.upsertEntitlement(decision);
    return { duplicate: false, decision };
  } catch (error) {
    await store.deleteEvent(webhookId);
    throw error;
  }
}

async function billingFetch(env, path, { method = 'GET', body, prefer } = {}) {
  const key = envGet(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const base = envGet(env, 'SUPABASE_URL').replace(/\/$/, '');
  if (!key || !base) {
    const error = new Error('Billing store is not configured.');
    error.code = 'BILLING_STORE_UNAVAILABLE';
    throw error;
  }
  const response = await fetch(`${base}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: prefer || 'return=minimal',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response;
}

export function supabaseBillingStore(env) {
  return {
    async insertEventIfNew(webhookId, decision) {
      const existing = await billingFetch(env, `billing_events?webhook_id=eq.${encodeURIComponent(webhookId)}&select=webhook_id`);
      if (existing.ok) {
        const rows = await existing.json().catch(() => []);
        if (Array.isArray(rows) && rows.length > 0) return false;
      }
      const response = await billingFetch(env, 'billing_events', {
        method: 'POST',
        prefer: 'return=minimal',
        body: {
          webhook_id: webhookId,
          event_type: decision.eventType || 'unknown',
          user_id: decision.userId || null,
          plan_code: decision.planCode || null,
          outcome: decision.outcome || 'ignored',
        },
      });
      if (response.status === 409) return false;
      if (!response.ok) {
        const error = new Error('Billing event was not recorded.');
        error.code = 'BILLING_EVENT_FAILED';
        throw error;
      }
      return true;
    },
    async userIdForEmail(email) {
      const response = await billingFetch(env, 'rpc/billing_user_id_for_email', {
        method: 'POST',
        prefer: 'return=representation',
        body: { p_email: email },
      });
      if (!response.ok) return '';
      const body = await response.json().catch(() => null);
      return typeof body === 'string' && USER_ID.test(body) ? body : '';
    },
    async deleteEvent(webhookId) {
      await billingFetch(env, `billing_events?webhook_id=eq.${encodeURIComponent(webhookId)}`, { method: 'DELETE' });
    },
    async upsertEntitlement(decision) {
      const rpc = await billingFetch(env, 'rpc/apply_billing_entitlement', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          p_user_id: decision.userId,
          p_plan_code: decision.planCode,
          p_status: decision.status,
          p_payment_id: decision.paymentId || null,
          p_subscription_id: decision.subscriptionId || null,
        },
      });
      if (rpc.ok) {
        const applied = await rpc.json().catch(() => ({}));
        if (applied && applied.ok === false) {
          const error = new Error('Entitlement was not recorded.');
          error.code = applied.code || 'ENTITLEMENT_FAILED';
          throw error;
        }
        if (decision.status === 'active') {
          const tier = tierForPlanCode(decision.planCode);
          recordProductEvent(env, { event: 'payment_succeeded', tier: tier === 'free' ? null : tier });
        }
        return;
      }
      const detail = await rpc.text().catch(() => '');
      if (rpc.status !== 404 && !detail.includes('PGRST202')) {
        const error = new Error('Entitlement was not recorded.');
        error.code = 'ENTITLEMENT_FAILED';
        throw error;
      }
      if (decision.planCode === 'pass') {
        if (decision.status === 'active') {
          const inserted = await billingFetch(env, 'sta_transfer_passes', {
            method: 'POST',
            prefer: 'return=minimal',
            body: {
              user_id: decision.userId,
              bytes_limit: 100000000000,
              retention_hours: 720,
              status: 'unused',
              payment_id: decision.paymentId || null,
            },
          });
          if (!inserted.ok && inserted.status !== 409) {
            const error = new Error('Pass was not recorded.');
            error.code = 'ENTITLEMENT_FAILED';
            throw error;
          }
          recordProductEvent(env, { event: 'payment_succeeded', tier: 'pass' });
        }
        return;
      }
      const response = await billingFetch(env, 'billing_entitlements?on_conflict=user_id', {
        method: 'POST',
        prefer: 'return=minimal,resolution=merge-duplicates',
        body: {
          user_id: decision.userId,
          plan_code: decision.planCode,
          status: decision.status,
          provider_payment_id: decision.paymentId || null,
          provider_subscription_id: decision.subscriptionId || null,
        },
      });
      if (!response.ok) {
        const error = new Error('Entitlement was not recorded.');
        error.code = 'ENTITLEMENT_FAILED';
        throw error;
      }
    },
  };
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function handleDodoWebhook({ request, env, store }) {
  const secret = envGet(env, 'DODO_WEBHOOK_SECRET') || envGet(env, 'DODO_PAYMENTS_WEBHOOK_KEY');
  if (!secret) return json(503, { error: 'Webhook verification is not configured.', code: 'WEBHOOK_UNAVAILABLE' });
  const raw = await request.text();
  try {
    await verifyDodoWebhook(raw, request.headers, secret);
  } catch {
    return json(401, { error: 'Invalid webhook signature.', code: 'WEBHOOK_SIGNATURE' });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Invalid webhook body.', code: 'WEBHOOK_BODY' });
  }
  const webhookId = request.headers.get('webhook-id') || '';
  if (!webhookId) return json(400, { error: 'Webhook id is required.', code: 'WEBHOOK_ID' });
  try {
    const result = await processDodoEvent({
      event,
      webhookId,
      store: store || supabaseBillingStore(env),
      products: productMap(env),
    });
    return json(200, { received: true, duplicate: result.duplicate === true });
  } catch {
    return json(503, { error: 'Webhook could not be recorded.', code: 'WEBHOOK_RECORD_FAILED' });
  }
}
