import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALIAS_TO,
  CANONICAL_ORIGIN,
  INDEXABLE_PATHS,
  ROUTE_SEO_MAP,
  canonicalUrlForPath,
  homepageStructuredData,
  resolveSeo,
} from '../functions/lib/seoRoutes.js';

const projectRoot = path.resolve(import.meta.dirname, '..');

const seo = {
  CANONICAL_ORIGIN,
  INDEXABLE_PATHS,
  ALIAS_TO,
  ROUTE_SEO_MAP,
  resolveSeo,
  homepageStructuredData,
  canonicalUrlForPath,
};

const EXPECTED_INDEXABLE = INDEXABLE_PATHS;

test('canonical host is https://sendtoanyone.com', () => {
  assert.equal(seo.CANONICAL_ORIGIN, 'https://sendtoanyone.com');
  assert.equal(seo.canonicalUrlForPath('/'), 'https://sendtoanyone.com/');
  assert.equal(seo.canonicalUrlForPath('/features/'), 'https://sendtoanyone.com/features');
  assert.equal(seo.canonicalUrlForPath('/help?utm=1'), 'https://sendtoanyone.com/help');
});

test('indexable routes have unique titles and descriptions and are not noindex', () => {
  assert.deepEqual(seo.INDEXABLE_PATHS, EXPECTED_INDEXABLE);

  const titles = new Map();
  const descriptions = new Map();
  for (const routePath of EXPECTED_INDEXABLE) {
    const decision = seo.resolveSeo({
      pathname: `${routePath}?utm=newsletter`,
      customTitle: 'Competing custom title',
      customDescription: 'Competing custom description',
      customCanonical: 'https://sendtoanyone.com/other?q=1',
    });
    assert.equal(decision.indexable, true, routePath);
    assert.match(decision.robots, /^index, follow/);
    assert.equal(decision.canonical, seo.canonicalUrlForPath(routePath));
    assert.equal(decision.canonical.startsWith('https://sendtoanyone.com'), true);
    assert.ok(!decision.canonical.includes('?'), routePath);
    assert.equal(decision.title, seo.ROUTE_SEO_MAP[routePath].title);
    assert.equal(decision.description, seo.ROUTE_SEO_MAP[routePath].description);
    assert.ok(decision.title.length > 10, routePath);
    assert.ok(decision.description.length > 40, routePath);

    const titleOwner = titles.get(decision.title);
    assert.equal(titleOwner, undefined, `Duplicate title for ${routePath} and ${titleOwner}: ${decision.title}`);
    titles.set(decision.title, routePath);

    const descriptionOwner = descriptions.get(decision.description);
    assert.equal(descriptionOwner, undefined, `Duplicate description for ${routePath} and ${descriptionOwner}`);
    descriptions.set(decision.description, routePath);
  }
});

test('alias routes are noindex and canonicalize to the primary even with a self URL', () => {
  for (const [aliasPath, primaryPath] of Object.entries(seo.ALIAS_TO)) {
    const decision = seo.resolveSeo({
      pathname: `${aliasPath}/?ref=ad`,
      customTitle: `Unique title for ${aliasPath}`,
      customDescription: `Unique description for ${aliasPath}`,
      customCanonical: `https://sendtoanyone.com${aliasPath}?token=1`,
    });
    assert.equal(decision.indexable, false, aliasPath);
    assert.equal(decision.robots, 'noindex, nofollow, noarchive', aliasPath);
    assert.equal(decision.canonical, seo.canonicalUrlForPath(primaryPath), aliasPath);
    assert.equal(decision.jsonLd, null, aliasPath);
    assert.equal(decision.title, seo.ROUTE_SEO_MAP[primaryPath].title, aliasPath);
    assert.ok(!EXPECTED_INDEXABLE.includes(aliasPath) || aliasPath === '/', aliasPath);
  }
});

test('query strings and trailing slashes do not create a second canonical', () => {
  assert.equal(
    seo.resolveSeo({ pathname: '/?mode=device' }).canonical,
    'https://sendtoanyone.com/'
  );
  assert.equal(
    seo.resolveSeo({ pathname: '/send-large-files/' }).canonical,
    'https://sendtoanyone.com/send-large-files'
  );
  assert.equal(
    seo.resolveSeo({ pathname: '/d/abc?token=secret' }).canonical,
    null
  );
  assert.equal(seo.resolveSeo({ pathname: '/download/abc/' }).robots, 'noindex, nofollow, noarchive');
  assert.equal(seo.resolveSeo({ pathname: '/request/abc' }).robots, 'noindex, nofollow, noarchive');
});

test('sitemap lists each indexable canonical once and omits aliases', () => {
  const sitemap = fs.readFileSync(path.join(projectRoot, 'public/sitemap.xml'), 'utf8');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<\/urlset>\s*$/);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expected = EXPECTED_INDEXABLE.map((routePath) => seo.canonicalUrlForPath(routePath));
  assert.deepEqual(urls, expected);
  for (const aliasPath of Object.keys(seo.ALIAS_TO)) {
    assert.ok(!urls.includes(`https://sendtoanyone.com${aliasPath}`), aliasPath);
  }
});

test('JSON-LD is valid, homepage-only for Organization and WebSite, and has no AggregateRating', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'functions/lib/seoRoutes.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert.doesNotMatch(source, /AggregateRating|priceCurrency|FAQPage/);
  assert.doesNotMatch(indexHtml, /AggregateRating|priceCurrency|FAQPage/);
  assert.match(source, /SoftwareApplication/);
  assert.match(indexHtml, /SoftwareApplication/);

  const home = seo.homepageStructuredData();
  const homeJson = JSON.parse(JSON.stringify(home));
  const homeTypes = homeJson['@graph'].map((node) => node['@type']);
  assert.deepEqual(homeTypes, ['Organization', 'WebSite', 'SoftwareApplication']);
  assert.equal(homeJson['@graph'][0].name, 'SendToAnyone');
  assert.equal(homeJson['@graph'][0].url, 'https://sendtoanyone.com');
  assert.equal(homeJson['@graph'][1].url, 'https://sendtoanyone.com');

  const homeDecision = seo.resolveSeo({ pathname: '/' });
  assert.deepEqual(homeDecision.jsonLd['@graph'].map((node) => node['@type']), ['Organization', 'WebSite', 'SoftwareApplication']);

  for (const routePath of EXPECTED_INDEXABLE.filter((item) => item !== '/')) {
    const decision = seo.resolveSeo({ pathname: routePath });
    const parsed = JSON.parse(JSON.stringify(decision.jsonLd));
    const types = parsed['@graph'].map((node) => node['@type']);
    assert.deepEqual(types, ['BreadcrumbList', 'WebPage'], routePath);
    assert.equal(parsed['@graph'][0].itemListElement[0].item, 'https://sendtoanyone.com/');
    assert.equal(parsed['@graph'][0].itemListElement[1].item, decision.canonical);
    assert.equal(parsed['@graph'].some((node) => node['@type'] === 'Organization'), false);
  }

  const shellJson = indexHtml.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(shellJson, 'index.html should ship homepage JSON-LD');
  const shell = JSON.parse(shellJson[1]);
  assert.deepEqual(shell['@graph'].map((node) => node['@type']), ['Organization', 'WebSite', 'SoftwareApplication']);
});

test('index.html is indexable and matches the homepage title and description', () => {
  const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const home = seo.ROUTE_SEO_MAP['/'];
  assert.match(indexHtml, /<meta name="robots" content="index, follow/);
  assert.doesNotMatch(indexHtml, /noindex/);
  assert.match(indexHtml, new RegExp(`<title>${home.title}</title>`));
  assert.match(indexHtml, new RegExp(`<meta name="description" content="${home.description}"`));
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/sendtoanyone\.com\/" \/>/);
  assert.match(indexHtml, /property="og:image" content="https:\/\/sendtoanyone\.com\/og\.png"/);
  assert.doesNotMatch(indexHtml, /hero_3d_cloudscape/);
});

test('indexable metadata does not claim storage quotas, end-to-end encryption, virus scanning, speeds, or paid plans', () => {
  const forbidden = /1\s*TB|end-to-end|zero-knowledge|virus|malware scan|gigabit|paid plan|AggregateRating/i;
  for (const routePath of EXPECTED_INDEXABLE) {
    const route = seo.ROUTE_SEO_MAP[routePath];
    assert.doesNotMatch(route.title, forbidden, routePath);
    assert.doesNotMatch(route.description, forbidden, routePath);
  }
});
