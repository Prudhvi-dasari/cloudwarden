import { timingSafeEqual } from './transferSecurity.js';

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

export function productMap(env) {
  return {
    monthly: envGet(env, 'DODO_PRODUCT_MONTHLY'),
    yearly: envGet(env, 'DODO_PRODUCT_YEARLY'),
  };
}

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

function eventProductId(data) {
  if (typeof data?.product_id === 'string' && data.product_id) return data.product_id;
  const cart = Array.isArray(data?.product_cart) ? data.product_cart : [];
  const first = cart.find((item) => typeof item?.product_id === 'string' && item.product_id);
  return first?.product_id || '';
}

function statusFor(type) {
  if (ACTIVATE.has(type)) return 'active';
  if (FAIL.has(type)) return 'failed';
  if (CANCEL.has(type)) return 'cancelled';
  if (EXPIRE.has(type)) return 'expired';
  if (PENDING.has(type)) return 'pending';
  return '';
}

export function decideBillingEvent(event, products) {
  const type = typeof event?.type === 'string' ? event.type : '';
  const data = event?.data && typeof event.data === 'object' ? event.data : {};
  const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {};
  const userId = typeof metadata.user_id === 'string' ? metadata.user_id : '';
  const productId = eventProductId(data);
  const configuredPlan = Object.entries(products || {}).find(([, id]) => id && id === productId)?.[0] || '';
  const metaPlan = metadata.plan_code === 'monthly' || metadata.plan_code === 'yearly' ? metadata.plan_code : '';
  const plan = metaPlan || configuredPlan;
  const productMatches = Boolean(plan && products?.[plan] && productId === products[plan]);
  const status = statusFor(type);
  const base = {
    eventType: type,
    userId: USER_ID.test(userId) ? userId : '',
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
  if (!plan || !products?.[plan]) return { ...base, outcome: 'unmapped_product' };
  return { ...base, outcome: status, apply: true };
}

export async function processDodoEvent({ event, webhookId, store, products }) {
  const decision = decideBillingEvent(event, products);
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
    async deleteEvent(webhookId) {
      await billingFetch(env, `billing_events?webhook_id=eq.${encodeURIComponent(webhookId)}`, { method: 'DELETE' });
    },
    async upsertEntitlement(decision) {
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
