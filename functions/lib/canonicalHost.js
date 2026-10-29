/**
 * Public site origin. Legacy hosts 301 here and must not appear in mail or canonical tags.
 * Keep INDEXABLE_PATHS and ALIAS_TO aligned with src/components/SeoHead.jsx.
 */

export const CANONICAL_ORIGIN = 'https://sendtoanyone.com';

export const LEGACY_HOSTS = new Set([
  'itransfer.iprudhvi.in',
  'www.sendtoanyone.com',
]);

export const INDEXABLE_PATHS = [
  '/',
  '/how-it-works',
  '/features',
  '/security',
  '/pricing',
  '/receive',
  '/teams',
  '/apps',
  '/api-docs',
  '/compare',
  '/qr-transfer',
  '/checksum',
  '/compliance',
  '/resources',
  '/privacy',
  '/terms',
  '/help',
  '/status',
  '/changelog',
  '/widget',
  '/send-large-files',
  '/send-files-without-signup',
  '/how-to-send-large-files',
];

export const ALIAS_TO = {
  '/transfers': '/',
  '/terms-and-conditions': '/terms',
  '/tos': '/terms',
  '/contact': '/help',
  '/vs-wetransfer': '/compare',
  '/vs-transfernow': '/compare',
  '/file-request': '/receive',
  '/send-large-video': '/send-large-files',
  '/send-folder-online': '/send-large-files',
  '/send-files-whatsapp': '/send-large-files',
  '/send-files-without-compression': '/send-large-files',
  '/file-transfer-free': '/send-large-files',
  '/create-file-sharing-link': '/send-large-files',
  '/send-files-by-email': '/how-to-send-large-files',
  '/expire-file-link': '/how-to-send-large-files',
  '/iphone-to-windows': '/qr-transfer',
  '/android-to-mac': '/qr-transfer',
  '/phone-to-laptop': '/qr-transfer',
  '/airdrop-alternative': '/qr-transfer',
  '/p2p-file-transfer': '/qr-transfer',
  '/wetransfer-alternative': '/compare',
  '/transfernow-alternative': '/compare',
  '/best-wetransfer-alternative-india': '/compare',
};

const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex, nofollow, noarchive';
const HOME_CANONICAL_TAG = '<link rel="canonical" href="https://sendtoanyone.com/" />';
const HOME_OG_URL = '<meta property="og:url" content="https://sendtoanyone.com/" />';
const HOME_TWITTER_URL = '<meta name="twitter:url" content="https://sendtoanyone.com/" />';

export function normalizePath(input) {
  const raw = String(input ?? '/');
  const pathOnly = raw.split('#')[0].split('?')[0];
  if (pathOnly === '' || pathOnly === '/') return '/';
  const withLeading = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  return withLeading.replace(/\/+$/, '') || '/';
}

export function canonicalUrlForPath(pathname) {
  const path = normalizePath(pathname);
  return path === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${path}`;
}

export function publicOrigin(value) {
  try {
    const url = new URL(value || CANONICAL_ORIGIN);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return CANONICAL_ORIGIN;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (LEGACY_HOSTS.has(host)) return CANONICAL_ORIGIN;
    return url.origin;
  } catch {
    return CANONICAL_ORIGIN;
  }
}

export function documentSeo(pathname) {
  const path = normalizePath(pathname);
  if (/^\/(d|download|request)\//.test(path)) {
    return { path, robots: NOINDEX_ROBOTS, canonical: null };
  }
  const aliasTarget = ALIAS_TO[path];
  if (aliasTarget) {
    return { path, robots: NOINDEX_ROBOTS, canonical: canonicalUrlForPath(aliasTarget) };
  }
  if (INDEXABLE_PATHS.includes(path)) {
    return { path, robots: INDEX_ROBOTS, canonical: canonicalUrlForPath(path) };
  }
  return { path, robots: NOINDEX_ROBOTS, canonical: null };
}

/**
 * GET/HEAD only. POST stays on the host that received it so API calls keep their method.
 * Download paths are included, so /d/:id on a legacy host moves with the slug intact.
 */
export function redirectLocation(requestUrl, method = 'GET') {
  const verb = String(method || 'GET').toUpperCase();
  if (verb !== 'GET' && verb !== 'HEAD') return null;
  let url;
  try {
    url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const legacy = LEGACY_HOSTS.has(host);
  const slash = url.pathname.length > 1 && url.pathname.endsWith('/');
  if (!legacy && !(host === 'sendtoanyone.com' && slash)) return null;
  const dest = new URL(CANONICAL_ORIGIN);
  dest.pathname = slash ? url.pathname.replace(/\/+$/, '') || '/' : url.pathname;
  dest.search = url.search;
  if (dest.href === url.href) return null;
  return dest.href;
}

export function rewriteDocumentHtml(pathname, html) {
  const decision = documentSeo(pathname);
  let next = String(html);
  if (decision.robots === NOINDEX_ROBOTS) {
    next = next.replaceAll(INDEX_ROBOTS, NOINDEX_ROBOTS);
  }
  if (decision.canonical) {
    next = next.replace(HOME_CANONICAL_TAG, `<link rel="canonical" href="${decision.canonical}" />`);
    next = next.replace(HOME_OG_URL, `<meta property="og:url" content="${decision.canonical}" />`);
    next = next.replace(HOME_TWITTER_URL, `<meta name="twitter:url" content="${decision.canonical}" />`);
  } else {
    next = next.replace(HOME_CANONICAL_TAG, '');
    next = next.replace(HOME_OG_URL, '');
    next = next.replace(HOME_TWITTER_URL, '');
  }
  if (decision.path !== '/') {
    next = next.replace(/<script type="application\/ld\+json" id="sendtoanyone-jsonld">[\s\S]*?<\/script>\s*/, '');
  }
  return next;
}
