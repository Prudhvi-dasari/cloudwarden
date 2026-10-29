import { redirectLocation, rewriteDocumentHtml } from './lib/canonicalHost.js';
import { cacheControlForDocument, countryFromRequest, injectPricingGeo } from './lib/pricingGeo.js';

export async function onRequest(context) {
  const target = redirectLocation(context.request.url, context.request.method);
  if (target) return Response.redirect(target, 301);

  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !type.includes('text/html')) return response;

  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/api/')) return response;

  const html = await response.text();
  const rewritten = injectPricingGeo(rewriteDocumentHtml(url.pathname, html), countryFromRequest(context.request));
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', cacheControlForDocument());
  headers.set('vary', 'CF-IPCountry');
  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
