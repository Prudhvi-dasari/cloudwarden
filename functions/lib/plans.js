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
  },
  {
    code: 'pro_monthly',
    tier: 'pro',
    interval: 'month',
    priceInr: 799,
    priceUsd: 15,
    env: 'DODO_PRODUCT_PRO_MONTHLY',
    aliasEnv: 'DODO_PRODUCT_MONTHLY',
  },
  {
    code: 'pro_yearly',
    tier: 'pro',
    interval: 'year',
    priceInr: 7999,
    priceUsd: 150,
    env: 'DODO_PRODUCT_PRO_YEARLY',
    aliasEnv: 'DODO_PRODUCT_YEARLY',
  },
  {
    code: 'studio_monthly',
    tier: 'studio',
    interval: 'month',
    priceInr: 2499,
    priceUsd: 39,
    env: 'DODO_PRODUCT_STUDIO_MONTHLY',
  },
  {
    code: 'pass',
    tier: 'pass',
    interval: 'once',
    priceInr: 149,
    priceUsd: 2,
    env: 'DODO_PRODUCT_PASS',
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

export function productIdFor(env, code) {
  const normalized = normalizeCheckoutCode(code);
  const plan = CHECKOUT_PLANS.find((item) => item.code === normalized);
  if (!plan) return '';
  return envGet(env, plan.env) || (plan.aliasEnv ? envGet(env, plan.aliasEnv) : '');
}

export function productMap(env) {
  const map = {};
  for (const plan of CHECKOUT_PLANS) map[plan.code] = productIdFor(env, plan.code);
  map.monthly = map.pro_monthly;
  map.yearly = map.pro_yearly;
  return map;
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

export function inrLabel(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export function offerFor(env, plan) {
  const limits = TIERS[plan.tier];
  const productId = productIdFor(env, plan.code);
  const gb = (bytes) => `${Math.round(bytes / GB)} GB`;
  const days = Math.round(limits.retentionHours / 24);
  return {
    code: plan.code,
    tier: plan.tier,
    priceLabel: inrLabel(plan.priceInr),
    usdLabel: `$${plan.priceUsd}`,
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
    productConfigured: Boolean(productId),
  };
}
