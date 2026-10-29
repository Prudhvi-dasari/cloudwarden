import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cacheControlForDocument, countryFromRequest, currencyForCountry, injectPricingGeo } from '../functions/lib/pricingGeo.js';

test('country currency is INR only for India and the Cloudflare country wins', () => {
  assert.equal(currencyForCountry('IN'), 'INR');
  assert.equal(currencyForCountry('us'), 'USD');
  assert.equal(currencyForCountry(''), 'USD');
  assert.equal(currencyForCountry('XX'), 'USD');

  const header = new Request('https://sendtoanyone.com/pricing', { headers: { 'cf-ipcountry': 'IN' } });
  assert.equal(countryFromRequest(header), 'IN');

  const cloudflare = new Request('https://sendtoanyone.com/pricing', { headers: { 'cf-ipcountry': 'US' } });
  Object.defineProperty(cloudflare, 'cf', { value: { country: 'IN' } });
  assert.equal(countryFromRequest(cloudflare), 'IN');
  assert.equal(countryFromRequest(new Request('https://sendtoanyone.com/pricing', { headers: { 'cf-ipcountry': 'T1' } })), '');
});

test('pricing geo is injected into the shell and documents stay uncached', () => {
  const shell = '<html><head><script id="sta-geo">window.__STA_GEO__={"country":"","currency":"USD"};</script></head><body></body></html>';
  const india = injectPricingGeo(shell, 'IN');
  assert.match(india, /window\.__STA_GEO__=\{"country":"IN","currency":"INR"\}/);
  assert.equal(india.includes('"currency":"USD"'), false);
  const elsewhere = injectPricingGeo(shell, 'US');
  assert.match(elsewhere, /window\.__STA_GEO__=\{"country":"US","currency":"USD"\}/);
  const bare = injectPricingGeo('<html><head></head><body></body></html>', 'DE');
  assert.match(bare, /<script id="sta-geo">window\.__STA_GEO__=\{"country":"DE","currency":"USD"\}<\/script><\/head>/);
  assert.equal(cacheControlForDocument(), 'private, no-store');
});
