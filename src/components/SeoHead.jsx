import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const CANONICAL_ORIGIN = 'https://sendtoanyone.com';

export const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const NOINDEX_ROBOTS = 'noindex, nofollow, noarchive';

/** Public URLs that may be indexed. Each appears once in the sitemap. */
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

/**
 * Same document served on another path. Canonical points at the primary.
 * /transfers is the dashboard alias of home and stays noindex.
 */
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

export const ROUTE_SEO_MAP = {
  '/': {
    title: 'Send large files free, up to 6 GB — SendToAnyone',
    description: 'Send a file up to 6 GB with no account. Share a link or email the link. Links last from 1 hour to 7 days.',
    crumb: 'Home',
  },
  '/how-it-works': {
    title: 'How a transfer works — SendToAnyone',
    description: 'A product walkthrough: choose a file, pick a link or email, and set an expiry up to 7 days. No account is required to send.',
    crumb: 'How it works',
  },
  '/features': {
    title: 'Transfer features — SendToAnyone',
    description: 'A transfer can include a link, optional email, an optional download password, and an expiry up to 7 days. The cap is 6 GB per transfer.',
    crumb: 'Features',
  },
  '/security': {
    title: 'Download password and storage — SendToAnyone',
    description: 'An optional password gates the download. It is checked as a SHA-256 hash, it is not in the email, and it does not encrypt the file.',
    crumb: 'Security',
  },
  '/pricing': {
    title: 'Free 6 GB transfers — SendToAnyone',
    description: 'Sending costs nothing. Each transfer can be up to 6 GB and the link can last up to 7 days. There is no upgrade that raises either limit.',
    crumb: 'Pricing',
  },
  '/receive': {
    title: 'Request files from someone else — SendToAnyone',
    description: 'Create a request link so another person can upload without an account. Their upload still caps at 6 GB and the request lasts up to 7 days.',
    crumb: 'Receive',
  },
  '/teams': {
    title: 'Sending with other people — SendToAnyone',
    description: 'There is no separate team workspace. Everyone uses the same transfer: up to 6 GB, links up to 7 days, and no account required to send.',
    crumb: 'Teams',
  },
  '/apps': {
    title: 'Browser only, no desktop app — SendToAnyone',
    description: 'SendToAnyone runs in the browser. There is no desktop app, mail plugin, or command-line tool. The limit is still 6 GB per transfer.',
    crumb: 'Apps',
  },
  '/api-docs': {
    title: 'No public API yet — SendToAnyone',
    description: 'There is no public API, SDK, or API key. Sample calls on this page are not a live service. Send a file from the browser instead.',
    crumb: 'API',
  },
  '/compare': {
    title: 'SendToAnyone compared with other send tools — SendToAnyone',
    description: 'SendToAnyone is 6 GB per transfer, no account to send, an optional download password, and links up to 7 days. This page is where tool limits are compared.',
    crumb: 'Compare',
  },
  '/qr-transfer': {
    title: 'QR and same-network device transfer — SendToAnyone',
    description: 'Move a file between two screens on the same network. That device transfer is not stored on the service. The 6 GB cap still applies.',
    crumb: 'QR transfer',
  },
  '/checksum': {
    title: 'SHA-256 and SHA-1 file check — SendToAnyone',
    description: 'Calculate a SHA-256 or SHA-1 hash in the browser on your device, then compare it with a hash you already trust.',
    crumb: 'Checksum',
  },
  '/compliance': {
    title: 'Data handling notes, not a certification — SendToAnyone',
    description: 'Files follow the expiry you set, up to 7 days. This page does not certify SendToAnyone against a compliance standard.',
    crumb: 'Compliance',
  },
  '/resources': {
    title: 'Guides and tools for sending a file — SendToAnyone',
    description: 'A short index of the send guide, the receive page, device transfer, and the checksum tool. Every transfer still caps at 6 GB.',
    crumb: 'Resources',
  },
  '/privacy': {
    title: 'Privacy policy — SendToAnyone',
    description: 'How a sent file is handled, when the link expires, and that sending does not require an account.',
    crumb: 'Privacy',
  },
  '/terms': {
    title: 'Terms of service — SendToAnyone',
    description: 'The rules for using SendToAnyone, including the 6 GB per transfer cap and links that last up to 7 days.',
    crumb: 'Terms',
  },
  '/help': {
    title: 'Help and contact — SendToAnyone',
    description: 'Short answers for sending a file, opening a link, and expiry, plus a form to reach the people who run SendToAnyone.',
    crumb: 'Help',
  },
  '/status': {
    title: 'File API status check — SendToAnyone',
    description: 'This page checks whether the file API answers. It does not report uptime, email delivery, or storage health.',
    crumb: 'Status',
  },
  '/changelog': {
    title: 'Product changelog — SendToAnyone',
    description: 'A record of changes that have already shipped. It is not a promise of future features.',
    crumb: 'Changelog',
  },
  '/widget': {
    title: 'Embed preview, no hosted widget — SendToAnyone',
    description: 'This page previews embed markup for a receive box. A hosted widget script is not part of the app. Use the receive page to collect files.',
    crumb: 'Widget',
  },
  '/send-large-files': {
    title: 'Send a large file, up to 6 GB — SendToAnyone',
    description: 'One transfer holds up to 6 GB and needs no account. Choose a link or email, and an expiry from 1 hour to 7 days. A bigger file has to be split.',
    crumb: 'Send a large file',
  },
  '/send-files-without-signup': {
    title: 'Send files without creating an account — SendToAnyone',
    description: 'The sender does not need an account, and neither does the recipient. Anyone who has the link can open it unless you add a download password.',
    crumb: 'No account',
  },
  '/how-to-send-large-files': {
    title: 'How to send a large file — SendToAnyone',
    description: 'Pick a file under 6 GB, create a link or email that link, and set an expiry up to 7 days. For a same-network move, use device transfer instead.',
    crumb: 'How to send',
  },
};

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

export function homepageStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'SendToAnyone',
        url: CANONICAL_ORIGIN,
        logo: `${CANONICAL_ORIGIN}/favicon.svg`,
      },
      {
        '@type': 'WebSite',
        name: 'SendToAnyone',
        url: CANONICAL_ORIGIN,
      },
    ],
  };
}

export function secondaryStructuredData({ title, description, url, crumb }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${CANONICAL_ORIGIN}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: crumb,
            item: url,
          },
        ],
      },
      {
        '@type': 'WebPage',
        name: title,
        description,
        url,
        isPartOf: {
          '@type': 'WebSite',
          name: 'SendToAnyone',
          url: CANONICAL_ORIGIN,
        },
      },
    ],
  };
}

export function resolveSeo({ pathname, customTitle, customDescription, customCanonical } = {}) {
  // Page-level props cannot mint a second canonical or a competing indexable title.
  void customTitle;
  void customDescription;
  void customCanonical;
  const currentPath = normalizePath(pathname);
  const isPrivateTransfer = /^\/(d|download|request)\//.test(currentPath);

  if (isPrivateTransfer) {
    const isRequest = currentPath.startsWith('/request/');
    return {
      title: isRequest ? 'Upload Files — SendToAnyone' : 'Download Files — SendToAnyone',
      description: 'A private transfer link. This page is not for public search.',
      robots: NOINDEX_ROBOTS,
      canonical: null,
      jsonLd: null,
      indexable: false,
    };
  }

  const aliasTarget = ALIAS_TO[currentPath];
  if (aliasTarget) {
    const primary = ROUTE_SEO_MAP[aliasTarget] || ROUTE_SEO_MAP['/'];
    return {
      title: primary.title,
      description: primary.description,
      robots: NOINDEX_ROBOTS,
      canonical: canonicalUrlForPath(aliasTarget),
      jsonLd: null,
      indexable: false,
    };
  }

  const route = ROUTE_SEO_MAP[currentPath];
  if (!route) {
    return {
      title: 'Page Not Found — SendToAnyone',
      description: 'The requested page does not exist.',
      robots: NOINDEX_ROBOTS,
      canonical: null,
      jsonLd: null,
      indexable: false,
    };
  }

  const canonical = canonicalUrlForPath(currentPath);
  const jsonLd = currentPath === '/'
    ? homepageStructuredData()
    : secondaryStructuredData({
      title: route.title,
      description: route.description,
      url: canonical,
      crumb: route.crumb,
    });

  return {
    title: route.title,
    description: route.description,
    robots: INDEX_ROBOTS,
    canonical,
    jsonLd,
    indexable: true,
  };
}

function removeMeta(attr, key) {
  document.querySelectorAll(`meta[${attr}="${key}"]`).forEach((node) => node.remove());
}

function setMetaTag(attr, key, content) {
  let elem = document.querySelector(`meta[${attr}="${key}"]`);
  if (!elem) {
    elem = document.createElement('meta');
    elem.setAttribute(attr, key);
    document.head.appendChild(elem);
  }
  elem.setAttribute('content', content);
}

function updateRobots(directives) {
  setMetaTag('name', 'robots', directives);
  setMetaTag('name', 'googlebot', directives);
  setMetaTag('name', 'bingbot', directives);
}

function updateCanonical(url) {
  let linkElem = document.querySelector('link[rel="canonical"]');
  if (!url) {
    if (linkElem) linkElem.remove();
    return;
  }
  if (!linkElem) {
    linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'canonical');
    document.head.appendChild(linkElem);
  }
  linkElem.setAttribute('href', url);
}

function updateJsonLd(payload) {
  document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => node.remove());
  if (!payload) return;
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.id = 'sendtoanyone-jsonld';
  ld.textContent = JSON.stringify(payload);
  document.head.appendChild(ld);
}

function clearSocialImages() {
  ['og:image', 'og:image:secure_url', 'og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt'].forEach((key) => {
    removeMeta('property', key);
  });
  removeMeta('name', 'twitter:image');
  removeMeta('name', 'twitter:image:alt');
  removeMeta('name', 'keywords');
}

export default function SeoHead({ customTitle, customDescription, customCanonical }) {
  const location = useLocation();

  useEffect(() => {
    const currentPath = normalizePath(location.pathname);
    const isPrivateTransfer = /^\/(d|download|request)\//.test(currentPath);
    const decision = resolveSeo({
      pathname: location.pathname,
      customTitle,
      customDescription,
      customCanonical,
    });

    document.title = decision.title;
    // /transfers stays crawlable in robots.txt so this noindex directive can be read.
    if (currentPath === '/transfers' || isPrivateTransfer || decision.robots.startsWith('noindex')) {
      updateRobots('noindex, nofollow, noarchive');
    } else {
      updateRobots(decision.robots);
    }

    setMetaTag('name', 'description', decision.description);
    setMetaTag('name', 'title', decision.title);
    clearSocialImages();

    if (decision.canonical) {
      setMetaTag('property', 'og:type', 'website');
      setMetaTag('property', 'og:site_name', 'SendToAnyone');
      setMetaTag('property', 'og:title', decision.title);
      setMetaTag('property', 'og:description', decision.description);
      setMetaTag('property', 'og:url', decision.canonical);
      setMetaTag('name', 'twitter:card', 'summary');
      setMetaTag('name', 'twitter:title', decision.title);
      setMetaTag('name', 'twitter:description', decision.description);
      setMetaTag('name', 'twitter:url', decision.canonical);
      updateCanonical(decision.canonical);
    } else {
      removeMeta('property', 'og:url');
      removeMeta('name', 'twitter:url');
      updateCanonical(null);
    }

    updateJsonLd(decision.jsonLd);
  }, [location.pathname, location.search, customTitle, customDescription, customCanonical]);

  return null;
}
