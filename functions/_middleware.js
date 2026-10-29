import { isAppDocument, normalizePath, redirectLocation, rewriteDocumentHtml } from './lib/canonicalHost.js';

function hasFileExtension(pathname) {
  return /\.[a-z0-9]{1,8}$/i.test(pathname);
}

async function documentShell(context, response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('text/html') && response.status !== 404) return response.text();
  const assets = context.env?.ASSETS;
  if (assets?.fetch) {
    const asset = await assets.fetch(new Request(new URL('/index.html', context.request.url)));
    if (asset.ok) return asset.text();
  }
  if (type.includes('text/html')) return response.text();
  return '';
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = redirectLocation(url, context.request.method);
  if (target) return Response.redirect(target, 301);

  const path = normalizePath(url.pathname);
  if (url.pathname.startsWith('/api/') || hasFileExtension(path)) return context.next();

  const response = await context.next();
  const shell = await documentShell(context, response);
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  headers.delete('content-length');

  if (!isAppDocument(path)) {
    if (!shell) {
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    headers.set('cache-control', 'no-store');
    headers.set('x-robots-tag', 'noindex');
    return new Response(rewriteDocumentHtml(path, shell, { notFound: true }), { status: 404, headers });
  }

  if (!shell) return response;
  headers.set('cache-control', 'public, max-age=300, stale-while-revalidate=86400');
  return new Response(rewriteDocumentHtml(path, shell), { status: 200, headers });
}
