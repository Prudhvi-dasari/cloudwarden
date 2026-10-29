import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CANONICAL_ORIGIN,
  INDEX_ROBOTS,
  INDEXABLE_PATHS,
  ALIAS_TO,
  NOINDEX_ROBOTS,
  OG_IMAGE,
  ROUTE_SEO_MAP,
  canonicalUrlForPath,
  homepageStructuredData,
  normalizePath,
  resolveSeo,
  secondaryStructuredData,
} from '../../functions/lib/seoRoutes.js';

export {
  CANONICAL_ORIGIN,
  INDEX_ROBOTS,
  INDEXABLE_PATHS,
  ALIAS_TO,
  NOINDEX_ROBOTS,
  ROUTE_SEO_MAP,
  canonicalUrlForPath,
  homepageStructuredData,
  normalizePath,
  resolveSeo,
  secondaryStructuredData,
};

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
      setMetaTag('name', 'twitter:card', 'summary_large_image');
      setMetaTag('name', 'twitter:title', decision.title);
      setMetaTag('name', 'twitter:description', decision.description);
      setMetaTag('name', 'twitter:url', decision.canonical);
      setMetaTag('property', 'og:image', OG_IMAGE);
      setMetaTag('property', 'og:image:width', '1200');
      setMetaTag('property', 'og:image:height', '630');
      setMetaTag('property', 'og:image:alt', 'SendToAnyone');
      setMetaTag('name', 'twitter:image', OG_IMAGE);
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
