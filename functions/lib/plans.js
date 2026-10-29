import { GB } from './storagePolicy.js';

/** Account and transfer limits. Prices are what Dodo charges; these numbers are what the server enforces. */
export const TIERS = {
  free: {
    tier: 'free',
    transferBytes: 6 * GB,
    storageBytes: 6 * GB,
    retentionHours: 7 * 24,
    brand: false,
    teamReady: false,
  },
  creator: {
    tier: 'creator',
    transferBytes: 50 * GB,
    storageBytes: 200 * GB,
    retentionHours: 30 * 24,
    brand: false,
    teamReady: false,
  },
  pro: {
    tier: 'pro',
    transferBytes: 250 * GB,
    storageBytes: 1000 * GB,
    retentionHours: 180 * 24,
    brand: true,
    teamReady: false,
  },
  studio: {
    tier: 'studio',
    transferBytes: 250 * GB,
    storageBytes: 3000 * GB,
    retentionHours: 365 * 24,
    brand: true,
    teamReady: true,
  },
  pass: {
    tier: 'pass',
    transferBytes: 100 * GB,
    storageBytes: 100 * GB,
    retentionHours: 30 * 24,
    brand: false,
    teamReady: false,
    oneTime: true,
  },
};

export const CHECKOUT_PLANS = [
  {
    code: 'creator_monthly',
    tier: 'creator',
    interval: 'month',
    priceInr: 299,
    priceUsd: 5,
    env: 'DODO_PRODUCT_CREATOR_MONTHLY',
    usdEnv: 'DODO_PRODUCT_CREATOR_MONTHLY_USD',
  },
  {
    code: 'pro_monthly',
    tier: 'pro',
    interval: 'month',
    priceInr: 799,
    priceUsd: 15,
    env: 'DODO_PRODUCT_PRO_MONTHLY',
    aliasEnv: 'DODO_PRODUCT_MONTHLY',
    usdEnv: 'DODO_PRODUCT_PRO_MONTHLY_USD',
    usdAliasEnv: 'DODO_PRODUCT_MONTHLY_USD',
  },
  {
    code: 'pro_yearly',
    tier: 'pro',
    interval: 'year',
    priceInr: 7999,
    priceUsd: 150,
    env: 'DODO_PRODUCT_PRO_YEARLY',
    aliasEnv: 'DODO_PRODUCT_YEARLY',
    usdEnv: 'DODO_PRODUCT_PRO_YEARLY_USD',
    usdAliasEnv: 'DODO_PRODUCT_YEARLY_USD',
  },
  {
    code: 'studio_monthly',
    tier: 'studio',
    interval: 'month',
    priceInr: 2499,
    priceUsd: 39,
    env: 'DODO_PRODUCT_STUDIO_MONTHLY',
    usdEnv: 'DODO_PRODUCT_STUDIO_MONTHLY_USD',
  },
  {
    code: 'pass',
    tier: 'pass',
    interval: 'once',
    priceInr: 149,
    priceUsd: 2,
    env: 'DODO_PRODUCT_PASS',
    usdEnv: 'DODO_PRODUCT_PASS_USD',
  },
];

const PLAN_CODES = new Set([
  'monthly',
  'yearly',
  'creator_monthly',
  'pro_monthly',
  'pro_yearly',
  'studio_monthly',
  'pass',
  'creator',
  'pro',
  'studio',
]);

function envGet(env, key) {
  if (env && env[key]) return env[key];
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  return '';
}

export function tierForPlanCode(code) {
  const value = String(code || '');
  if (value === 'monthly' || value === 'yearly' || value === 'pro_monthly' || value === 'pro_yearly' || value === 'pro') {
    return 'pro';
  }
  if (value === 'creator_monthly' || value === 'creator') return 'creator';
  if (value === 'studio_monthly' || value === 'studio') return 'studio';
  if (value === 'pass') return 'pass';
  return 'free';
}

export function normalizeCheckoutCode(code) {
  if (code === 'monthly') return 'pro_monthly';
  if (code === 'yearly') return 'pro_yearly';
  return String(code || '');
}

export function isCheckoutCode(code) {
  const normalized = normalizeCheckoutCode(code);
  return CHECKOUT_PLANS.some((plan) => plan.code === normalized) || code === 'monthly' || code === 'yearly';
}

export function isPlanCode(code) {
  return PLAN_CODES.has(String(code || ''));
}

function planByCode(code) {
  const normalized = normalizeCheckoutCode(code);
  return CHECKOUT_PLANS.find((item) => item.code === normalized) || null;
}

function inrProductId(env, plan) {
  return envGet(env, plan.env) || (plan.aliasEnv ? envGet(env, plan.aliasEnv) : '');
}

function usdProductId(env, plan) {
  return envGet(env, plan.usdEnv) || (plan.usdAliasEnv ? envGet(env, plan.usdAliasEnv) : '');
}

/**
 * India always charges the INR product.
 * Everywhere else charges the USD product when that env var is set, and the INR product until it is.
 * Adaptive currency is not used: it would convert the rupee price at a live rate instead of the catalog dollar price.
 */
export function checkoutProduct(env, code, currency = 'USD') {
  const plan = planByCode(code);
  const wanted = currency === 'INR' ? 'INR' : 'USD';
  if (!plan) return { productId: '', currency: wanted, fallback: false };
  const inr = inrProductId(env, plan);
  const usd = usdProductId(env, plan);
  if (wanted === 'INR') return { productId: inr, currency: 'INR', fallback: false };
  if (usd) return { productId: usd, currency: 'USD', fallback: false };
  if (inr) return { productId: inr, currency: 'INR', fallback: true };
  return { productId: '', currency: 'USD', fallback: false };
}

export function productIdFor(env, code, currency = 'INR') {
  return checkoutProduct(env, code, currency).productId;
}

function idsOf(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((id) => typeof id === 'string' && id);
}

export function productMap(env) {
  const map = {};
  for (const plan of CHECKOUT_PLANS) {
    const ids = [inrProductId(env, plan), usdProductId(env, plan)].filter(Boolean);
    map[plan.code] = ids.length > 1 ? ids : (ids[0] || '');
  }
  map.monthly = map.pro_monthly;
  map.yearly = map.pro_yearly;
  return map;
}

export function planCodeForProduct(products, productId) {
  if (!productId) return '';
  for (const [code, value] of Object.entries(products || {})) {
    if (idsOf(value).includes(productId)) return code;
  }
  return '';
}

export function configuredProductIds(products, planCode) {
  const code = String(planCode || '');
  const normalized = normalizeCheckoutCode(code);
  const keys = new Set([code, normalized]);
  if (normalized === 'pro_monthly' || code === 'monthly') {
    keys.add('monthly');
    keys.add('pro_monthly');
  }
  if (normalized === 'pro_yearly' || code === 'yearly') {
    keys.add('yearly');
    keys.add('pro_yearly');
  }
  const ids = [];
  for (const key of keys) {
    for (const id of idsOf(products?.[key])) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export function entitlementAllows(entitlement) {
  const status = entitlement?.status || entitlement?.entitlementStatus || '';
  if (status !== 'active') return { ...TIERS.free, paid: false };
  const tierName = tierForPlanCode(entitlement.planCode || entitlement.plan_code || 'pro');
  if (tierName === 'pass') return { ...TIERS.free, paid: false };
  const tier = TIERS[tierName] || TIERS.free;
  return { ...tier, paid: tier.tier !== 'free' };
}

export function planExpiryDays(planCode) {
  const code = normalizeCheckoutCode(planCode);
  if (code === 'pro_yearly' || planCode === 'yearly') return 366;
  return 32;
}

export function moneyLabel(currency, amount) {
  const value = Number(amount);
  if (currency === 'INR') return `₹${value.toLocaleString('en-IN')}`;
  return `$${value.toLocaleString('en-US')}`;
}

export function inrLabel(amount) {
  return moneyLabel('INR', amount);
}

export function offerFor(env, plan, currency = 'USD') {
  const limits = TIERS[plan.tier];
  const choice = checkoutProduct(env, plan.code, currency);
  const shown = currency === 'INR' ? 'INR' : 'USD';
  const gb = (bytes) => `${Math.round(bytes / GB)} GB`;
  const days = Math.round(limits.retentionHours / 24);
  return {
    code: plan.code,
    tier: plan.tier,
    currency: shown,
    priceLabel: moneyLabel(shown, shown === 'INR' ? plan.priceInr : plan.priceUsd),
    inrLabel: moneyLabel('INR', plan.priceInr),
    usdLabel: moneyLabel('USD', plan.priceUsd),
    chargeCurrency: choice.currency,
    chargeLabel: moneyLabel(choice.currency, choice.currency === 'INR' ? plan.priceInr : plan.priceUsd),
    currencyFallback: choice.fallback,
    interval: plan.interval === 'year'
      ? 'Billed once a year'
      : plan.interval === 'once'
        ? 'One transfer'
        : 'Billed every month',
    transfer: gb(limits.transferBytes),
    storage: plan.tier === 'pass' ? 'One transfer' : gb(limits.storageBytes),
    retention: days >= 365 ? '1 year' : `${days} days`,
    oneTime: plan.interval === 'once',
    hidden: false,
    productConfigured: Boolean(choice.productId),
  };
}
