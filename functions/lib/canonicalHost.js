/**
 * Public site origin. Legacy hosts and retired aliases 301 here.
 * Route lists live in seoRoutes.js so the edge and the app stay aligned.
 */

import {
  ALIAS_TO,
  CANONICAL_ORIGIN,
  INDEXABLE_PATHS,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  NOT_FOUND,
  OG_IMAGE,
  REDIRECTS,
  ROUTE_SEO_MAP,
  canonicalUrlForPath,
  escapeHtml,
  isAppDocument,
  normalizePath,
  prerenderArticle,
  resolveSeo,
} from './seoRoutes.js';

export {
  ALIAS_TO,
  CANONICAL_ORIGIN,
  INDEXABLE_PATHS,
  REDIRECTS,
  ROUTE_SEO_MAP,
  canonicalUrlForPath,
  isAppDocument,
  normalizePath,
  resolveSeo,
};

export const LEGACY_HOSTS = new Set([
  'itransfer.iprudhvi.in',
  'www.sendtoanyone.com',
]);

const HOME_CANONICAL_TAG = '<link rel="canonical" href="https://sendtoanyone.com/" />';
const HOME_OG_URL = '<meta property="og:url" content="https://sendtoanyone.com/" />';
const HOME_TWITTER_URL = '<meta name="twitter:url" content="https://sendtoanyone.com/" />';

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
  const decision = resolveSeo({ pathname });
  return {
    path: normalizePath(pathname),
    robots: decision.robots,
    canonical: decision.canonical,
    title: decision.title,
    description: decision.description,
    jsonLd: decision.jsonLd,
    indexable: decision.indexable,
  };
}

/**
 * GET/HEAD only. POST stays on the host that received it so API calls keep their method.
 * www and other legacy hosts move to the apex. Retired aliases 301 in the same hop.
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
  const path = normalizePath(url.pathname);
  const slash = url.pathname.length > 1 && url.pathname.endsWith('/');
  const alias = REDIRECTS[path];
  if (!legacy && !(host === 'sendtoanyone.com' && slash) && !alias) return null;
  const dest = new URL(CANONICAL_ORIGIN);
  dest.pathname = alias || path;
  dest.search = url.search;
  if (dest.href === url.href) return null;
  return dest.href;
}

function replaceTitle(html, title) {
  const safe = escapeHtml(title);
  if (html.includes('<title>')) return html.replace(/<title>[^<]*<\/title>/, `<title>${safe}</title>`);
  return html;
}

function replaceMeta(html, attr, key, content) {
  const safe = escapeHtml(content);
  const pattern = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`, 'i');
  if (pattern.test(html)) return html.replace(pattern, `$1${safe}$2`);
  return html.replace('</head>', `    <meta ${attr}="${key}" content="${safe}" />\n  </head>`);
}

function upsertImage(html) {
  let next = html;
  if (!next.includes('property="og:image"')) {
    next = next.replace('</head>', `    <meta property="og:image" content="${OG_IMAGE}" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta property="og:image:alt" content="SendToAnyone" />\n    <meta name="twitter:image" content="${OG_IMAGE}" />\n  </head>`);
  }
  next = next.replace(/<meta name="twitter:card" content="summary" \/>/, '<meta name="twitter:card" content="summary_large_image" />');
  return next;
}

function replaceJsonLd(html, payload) {
  const block = payload
    ? `<script type="application/ld+json" id="sendtoanyone-jsonld">\n    ${JSON.stringify(payload)}\n    </script>`
    : '';
  if (html.includes('id="sendtoanyone-jsonld"')) {
    return html.replace(/<script type="application\/ld\+json" id="sendtoanyone-jsonld">[\s\S]*?<\/script>/, block);
  }
  if (!block) return html;
  return html.replace('</head>', `    ${block}\n  </head>`);
}

function replaceRoot(html, article) {
  const marker = '<div id="root">';
  const start = html.indexOf(marker);
  if (start < 0) return html;
  let index = start + marker.length;
  let depth = 1;
  while (index < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', index);
    const nextClose = html.indexOf('</div>', index);
    if (nextClose < 0) return html;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) {
        return `${html.slice(0, start + marker.length)}\n      ${article}\n    ${html.slice(nextClose)}`;
      }
      index = nextClose + 6;
    }
  }
  return html;
}

export function rewriteDocumentHtml(pathname, html, { notFound = false } = {}) {
  const path = normalizePath(pathname);
  const route = notFound ? NOT_FOUND : (ROUTE_SEO_MAP[path] || (ALIAS_TO[path] ? ROUTE_SEO_MAP[ALIAS_TO[path]] : null));
  const decision = notFound
    ? { robots: NOINDEX_ROBOTS, canonical: null, title: NOT_FOUND.title, description: NOT_FOUND.description, jsonLd: null }
    : documentSeo(path);
  let next = String(html);
  if (decision.robots === NOINDEX_ROBOTS) next = next.replaceAll(INDEX_ROBOTS, NOINDEX_ROBOTS);
  if (decision.canonical) {
    next = next.replace(HOME_CANONICAL_TAG, `<link rel="canonical" href="${decision.canonical}" />`);
    next = next.replace(HOME_OG_URL, `<meta property="og:url" content="${decision.canonical}" />`);
    next = next.replace(HOME_TWITTER_URL, `<meta name="twitter:url" content="${decision.canonical}" />`);
  } else {
    next = next.replace(HOME_CANONICAL_TAG, '');
    next = next.replace(HOME_OG_URL, '');
    next = next.replace(HOME_TWITTER_URL, '');
  }
  if (decision.title) next = replaceTitle(next, decision.title);
  if (decision.description) {
    next = replaceMeta(next, 'name', 'description', decision.description);
    next = replaceMeta(next, 'property', 'og:title', decision.title);
    next = replaceMeta(next, 'property', 'og:description', decision.description);
    next = replaceMeta(next, 'name', 'twitter:title', decision.title);
    next = replaceMeta(next, 'name', 'twitter:description', decision.description);
    next = replaceMeta(next, 'name', 'title', decision.title);
  }
  if (decision.canonical) next = upsertImage(next);
  next = replaceJsonLd(next, decision.jsonLd);
  if (route?.h1) next = replaceRoot(next, prerenderArticle(route));
  return next;
}
