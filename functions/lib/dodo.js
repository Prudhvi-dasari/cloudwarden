import { CANONICAL_ORIGIN, publicOrigin } from './canonicalHost.js';
import { previewBlockResponse } from './previewGuard.js';
import { STORAGE_POLICY } from './storagePolicy.js';
import { handleDodoWebhook } from './dodoWebhook.js';
import { CHECKOUT_PLANS, entitlementAllows, isCheckoutCode, normalizeCheckoutCode, offerFor, productIdFor, productMap } from './plans.js';
import { recordProductEvent } from './productEvents.js';

const PLANS = new Set(['monthly', 'yearly', ...CHECKOUT_PLANS.map((plan) => plan.code)]);

function envGet(env, key) {
  if (env && env[key]) return env[key];
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  return '';
}

function cookieValue(request, name) {
  const header = request?.headers?.get?.('cookie') || '';
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName !== name) continue;
    try {
      return decodeURIComponent(rest.join('='));
    } catch {
      return rest.join('=');
    }
  }
  return '';
}

function textValue(value) {
  return typeof value === 'string' ? value : '';
}

function minilyticsMetadata(request) {
  return {
    ml_visitor_id: cookieValue(request, 'ml_vid'),
    ml_session_id: cookieValue(request, 'ml_sid'),
  };
}

export function dodoApiBase(env) {
  return envGet(env, 'DODO_ENV') === 'live'
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com';
}

export function checkoutPurchasable(env) {
  return envGet(env, 'DODO_CHECKOUT_ENABLED') === 'true' && STORAGE_POLICY.paidFeaturesEnabled === true;
}

export function transferAllowance(entitlement) {
  const allowance = entitlementAllows(entitlement || {});
  return {
    bytes: allowance.transferBytes,
    hours: allowance.retentionHours,
    storageBytes: allowance.storageBytes,
    tier: allowance.tier,
    paidFeaturesEnabled: STORAGE_POLICY.paidFeaturesEnabled,
    entitlementStatus: entitlement?.status || 'free',
  };
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'cache-control': 'no-store',
    },
  });
}

function supabaseBase(env) {
  return envGet(env, 'SUPABASE_URL').replace(/\/$/, '');
}

const PUBLISHABLE_KEY = 'sb_publishable_XenT3T8l2M0-SWsHDJZpUg_3elJqmVU';

function publishableKey(env) {
  return envGet(env, 'SUPABASE_PUBLISHABLE_KEY')
    || envGet(env, 'SUPABASE_ANON_KEY')
    || (env?.ITRANSFER_ISOLATED === '1' ? '' : PUBLISHABLE_KEY);
}

async function authenticatedUser(request, env) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)/i);
  if (!match) return null;
  const base = supabaseBase(env);
  const key = publishableKey(env);
  if (!base || !key) return { invalid: true };
  let response;
  try {
    response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${match[1]}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { invalid: true, unavailable: true };
  }
  if (!response.ok) return { invalid: true };
  const body = await response.json().catch(() => ({}));
  if (!body?.id || typeof body.id !== 'string') return { invalid: true };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  return { id: body.id, email };
}

function offers(env) {
  const products = productMap(env);
  const open = checkoutPurchasable(env);
  const listed = CHECKOUT_PLANS.map((plan) => {
    const offer = offerFor(env, plan);
    return { ...offer, purchasable: open && offer.productConfigured };
  });
  listed.push(
    { ...listed.find((plan) => plan.code === 'pro_monthly'), code: 'monthly', hidden: true },
    { ...listed.find((plan) => plan.code === 'pro_yearly'), code: 'yearly', hidden: true },
  );
  return {
    provider: 'dodo',
    mode: envGet(env, 'DODO_ENV') === 'live' ? 'live' : 'test',
    purchasable: open,
    currencyNote: 'Prices are shown in INR and USD. Dodo charges the price on the product you select.',
    reason: open
      ? 'Dodo charges the price on its checkout page. The plan starts after the server confirms the payment.'
      : 'Checkout is closed until each Dodo product id is configured.',
    plans: listed.filter((plan) => plan && plan.code),
    productsConfigured: Object.fromEntries(Object.entries(products).map(([code, id]) => [code, Boolean(id)])),
  };
}

function siteOrigin(request, env) {
  return publicOrigin(request?.url || envGet(env, 'APP_URL') || CANONICAL_ORIGIN);
}

async function createCheckout({ request, env, plan, returnPath = '/pricing' }) {
  const user = await authenticatedUser(request, env);
  if (user?.unavailable) {
    return json(503, { error: 'Sign-in could not be verified. Try again.', code: 'AUTH_UNAVAILABLE' });
  }
  if (!user || user.invalid || !user.id) {
    return json(401, { error: 'Sign in before starting checkout.', code: 'AUTH_REQUIRED' });
  }
  if (envGet(env, 'DODO_CHECKOUT_ENABLED') !== 'true') {
    return json(503, {
      error: 'Checkout is closed until a Dodo product and a paid transfer limit are configured.',
      code: 'CHECKOUT_DISABLED',
    });
  }
  const products = productMap(env);
  const checkoutCode = normalizeCheckoutCode(plan);
  const productId = productIdFor(env, checkoutCode) || products[plan];
  if (!productId) {
    return json(503, { error: 'This plan has no Dodo product configured.', code: 'PRODUCT_UNCONFIGURED' });
  }
  const apiKey = envGet(env, 'DODO_API_KEY') || envGet(env, 'DODO_PAYMENTS_API_KEY');
  if (!apiKey) {
    return json(503, { error: 'Dodo Payments is not configured.', code: 'CHECKOUT_UNAVAILABLE' });
  }

  let response;
  try {
    response = await fetch(`${dodoApiBase(env)}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: user.email ? { email: user.email } : undefined,
        return_url: `${siteOrigin(request, env)}${returnPath}?checkout=return`,
        metadata: {
          ...minilyticsMetadata(request),
          user_id: user.id,
          plan_code: checkoutCode,
          email: user.email || '',
        },
      }),
    });
  } catch {
    return json(502, { error: 'Checkout did not respond. Try again.', code: 'CHECKOUT_TIMEOUT' });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rejected = response.status === 401 || response.status === 403;
    return json(502, {
      error: rejected
        ? 'Dodo rejected the payment key, so checkout cannot open.'
        : 'Dodo checkout failed.',
      code: 'CHECKOUT_FAILED',
    });
  }
  const checkoutUrl = typeof data.checkout_url === 'string' ? data.checkout_url : '';
  let host = '';
  try { host = new URL(checkoutUrl).hostname; } catch { host = ''; }
  if (!checkoutUrl || !host.endsWith('dodopayments.com')) {
    return json(502, { error: 'Dodo did not return a checkout link.', code: 'CHECKOUT_URL_MISSING' });
  }
  return json(200, { checkoutUrl, sessionId: data.session_id || '' });
}

export async function handlePaymentRequest({ request, env }) {
  if (request.method === 'OPTIONS') return json(200, { ok: true });
  const previewBlock = previewBlockResponse(request, env);
  if (previewBlock) return previewBlock;

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'checkout';

  if (action === 'webhook') {
    if (request.method !== 'POST') return json(405, { error: 'POST required.', code: 'METHOD' });
    return handleDodoWebhook({ request, env, store: env?.billingStore });
  }

  if (action === 'health' || action === 'offers') {
    return json(200, offers(env));
  }

  if (action !== 'checkout' || request.method !== 'POST') {
    return json(400, { error: 'Unsupported payment action.', code: 'UNSUPPORTED' });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { error: 'Invalid checkout request.', code: 'INVALID_BODY' });
  }
  if (body.product_id || body.productId || body.price || body.amount || body.price_id) {
    return json(400, { error: 'Product and price are chosen on the server.', code: 'PRODUCT_NOT_ALLOWED' });
  }
  const plan = textValue(body.plan || body.billingCycle);
  if (!isCheckoutCode(plan) && !PLANS.has(plan)) return json(400, { error: 'Unknown plan.', code: 'UNKNOWN_PLAN' });
  const returnPath = body.returnPath === '/' ? '/' : '/pricing';
  return createCheckout({ request, env, plan, returnPath });
}
