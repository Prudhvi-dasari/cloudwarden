const BLOCKED = new Set(['XX', 'T1']);

export function normalizeCountry(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || BLOCKED.has(code)) return '';
  return code;
}

export function currencyForCountry(country) {
  return normalizeCountry(country) === 'IN' ? 'INR' : 'USD';
}

/** Cloudflare country wins over a client-supplied CF-IPCountry header. Local dev has no request.cf, so the header is the override. */
export function countryFromRequest(request) {
  const cf = request?.cf && typeof request.cf.country === 'string' ? request.cf.country : '';
  const header = request?.headers?.get?.('cf-ipcountry') || '';
  return normalizeCountry(cf || header);
}

export function pricingGeoForRequest(request) {
  const country = countryFromRequest(request);
  return { country, currency: currencyForCountry(country) };
}

/**
 * The shell is one HTML document with the country baked in, so a shared cache
 * would reuse an India page for a US visitor. Assets stay cacheable.
 */
export function cacheControlForDocument() {
  return 'private, no-store';
}

export function injectPricingGeo(html, country) {
  const code = normalizeCountry(country);
  const payload = JSON.stringify({ country: code, currency: currencyForCountry(code) }).replace(/</g, '\\u003c');
  const assignment = `window.__STA_GEO__=${payload}`;
  const source = String(html);
  if (source.includes('id="sta-geo"')) {
    return source.replace(/window\.__STA_GEO__=\{[^<]*\}/, assignment);
  }
  return source.replace('</head>', `<script id="sta-geo">${assignment}</script></head>`);
}
