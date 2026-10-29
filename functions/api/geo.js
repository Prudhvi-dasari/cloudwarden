import { countryFromRequest, currencyForCountry } from '../lib/pricingGeo.js';

export async function onRequest(context) {
  const { request } = context;
  const cf = request.cf || {};
  const country = countryFromRequest(request);
  const city = cf.city || request.headers.get('cf-ipcity') || '';
  const timezone = cf.timezone || '';
  return new Response(JSON.stringify({
    countryCode: country || null,
    currency: currencyForCountry(country),
    city,
    timezone,
    colo: cf.colo || '',
    ip: request.headers.get('cf-connecting-ip') || '',
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
