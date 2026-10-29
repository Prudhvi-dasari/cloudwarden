export const CURRENCY_STORAGE_KEY = 'sta_currency';

export function readPricingGeo() {
  const geo = typeof window === 'undefined' ? null : window.__STA_GEO__;
  const currency = geo?.currency === 'INR' ? 'INR' : 'USD';
  const displayCurrency = geo?.displayCurrency === 'INR' || geo?.displayCurrency === 'USD'
    ? geo.displayCurrency
    : currency;
  return {
    country: typeof geo?.country === 'string' ? geo.country : '',
    currency,
    displayCurrency,
    hasDisplayOverride: displayCurrency !== currency && (geo?.displayCurrency === 'INR' || geo?.displayCurrency === 'USD'),
  };
}

export function rememberDisplayCurrency(currency) {
  const next = currency === 'INR' ? 'INR' : 'USD';
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, next);
  } catch {
    // Private browsing can reject storage. The in-memory choice still applies.
  }
  if (typeof window !== 'undefined') {
    window.__STA_GEO__ = { ...(window.__STA_GEO__ || { country: '', currency: 'USD' }), displayCurrency: next };
  }
  return next;
}

export function labelForCurrency(plan, currency) {
  if (!plan) return '';
  if (currency === 'INR') return plan.inrLabel || plan.priceLabel || '';
  return plan.usdLabel || plan.priceLabel || '';
}
