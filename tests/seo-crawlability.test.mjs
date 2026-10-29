import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('robots.txt strictly blocks crawling on private endpoints while allowing /transfers so noindex is observed', () => {
  const robotsTxt = fs.readFileSync(path.join(projectRoot, 'public/robots.txt'), 'utf8');

  // Verify User-agent blocks exist
  assert.match(robotsTxt, /User-agent:\s+\*/);
  assert.match(robotsTxt, /User-agent:\s+Googlebot/);
  assert.match(robotsTxt, /User-agent:\s+Bingbot/);

  // Private ephemeral endpoints that must NEVER be crawled
  const requiredDisallows = [
    '/api/',
    '/download/',
    '/d/',
    '/request/',
    '/admin',
    '/*?*token=*',
    '/*?*key=*',
  ];

  // Split into sections by User-agent
  const sections = robotsTxt.split(/User-agent:\s+/i).slice(1);
  const botSections = {};
  for (const section of sections) {
    const lines = section.trim().split('\n');
    const agent = lines[0].trim();
    botSections[agent] = section;
  }

  for (const agent of ['*', 'Googlebot', 'Bingbot']) {
    const section = botSections[agent];
    assert.ok(section, `Missing section for User-agent: ${agent}`);
    for (const disallow of requiredDisallows) {
      assert.ok(
        section.includes(`Disallow: ${disallow}`),
        `User-agent: ${agent} must disallow ${disallow}`
      );
    }
  }

  // /transfers must NOT be blocked by robots.txt so crawlers can fetch it and read the noindex directive
  assert.match(robotsTxt, /Allow:\s+\/transfers/, '/transfers must be crawlable to deliver noindex directive');
  assert.match(robotsTxt, /Sitemap:\s+https:\/\/sendtoanyone\.com\/sitemap\.xml/);

  const publicPaths = ['/send-large-files', '/how-it-works', '/receive', '/compare', '/qr-transfer'];
  for (const agent of ['*', 'Googlebot', 'Bingbot']) {
    const section = botSections[agent];
    for (const publicPath of publicPaths) {
      assert.ok(
        !section.includes(`Disallow: ${publicPath}`),
        `User-agent: ${agent} must not disallow public path ${publicPath}`
      );
    }
  }
});

test('public/_headers enforces X-Robots-Tag: noindex on crawlable dashboard and static private endpoints', () => {
  const headers = fs.readFileSync(path.join(projectRoot, 'public/_headers'), 'utf8');

  // /transfers is crawlable, so compliant crawlers will directly inspect this header
  assert.ok(headers.includes('/transfers'), '_headers must contain rule for /transfers');

  // Static SPA endpoints have X-Robots-Tag as defense-in-depth for non-compliant bots that ignore robots.txt
  // Note: Cloudflare Pages _headers applies exclusively to static assets and SPA routes, not Functions (/api/*)
  const staticPrivateEndpoints = ['/d/*', '/download/*', '/request/*'];
  for (const endpoint of staticPrivateEndpoints) {
    assert.ok(headers.includes(endpoint), `_headers must contain rule for static SPA route ${endpoint}`);
  }
  assert.ok(
    headers.includes('X-Robots-Tag: noindex, nofollow, noarchive'),
    '_headers must enforce noindex, nofollow, noarchive header'
  );
  // Assert that _headers does not make defunct promises for Pages Functions
  assert.ok(!headers.includes('/api/*'), '_headers must not claim to control Cloudflare Pages Functions');
});

test('public/sitemap.xml contains only canonical indexable URLs and zero private/tokenized/dashboard endpoints', () => {
  const sitemap = fs.readFileSync(path.join(projectRoot, 'public/sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  assert.ok(urls.length > 0, 'Sitemap must contain URLs');

  for (const url of urls) {
    assert.ok(
      url.startsWith('https://sendtoanyone.com'),
      `URL ${url} must use official production canonical origin`
    );
    assert.ok(!url.includes('/transfers'), `Sitemap must never expose dashboard route /transfers: ${url}`);
    assert.ok(!url.includes('/d/'), `Sitemap must never expose private /d/ route: ${url}`);
    assert.ok(!url.includes('/download/'), `Sitemap must never expose private /download/ route: ${url}`);
    assert.ok(!url.includes('/request/'), `Sitemap must never expose private /request/ route: ${url}`);
    assert.ok(!url.includes('/api/'), `Sitemap must never expose backend /api/ route: ${url}`);
    assert.ok(!url.includes('/admin'), `Sitemap must never expose /admin route: ${url}`);
    assert.ok(!url.includes('token='), `Sitemap must never expose tokenized URLs: ${url}`);
    assert.ok(!url.includes('?'), `Sitemap URL must not include a query string: ${url}`);
    if (url !== 'https://sendtoanyone.com/') {
      assert.ok(!url.endsWith('/'), `Sitemap URL must not have a trailing slash: ${url}`);
    }
  }

  assert.equal(new Set(urls).size, urls.length, 'Sitemap URLs must be unique');
  assert.ok(!sitemap.includes('<changefreq>'), 'Sitemap must not invent changefreq');
  assert.ok(!sitemap.includes('<priority>'), 'Sitemap must not invent priority');
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((sitemap.match(/<url>/g) || []).length, (sitemap.match(/<\/url>/g) || []).length);

  const aliasPaths = [
    '/transfers',
    '/terms-and-conditions',
    '/tos',
    '/contact',
    '/vs-wetransfer',
    '/vs-transfernow',
    '/send-folder-online',
    '/send-files-without-compression',
    '/file-transfer-free',
    '/create-file-sharing-link',
    '/expire-file-link',
    '/iphone-to-windows',
    '/android-to-mac',
    '/qr-transfer',
    '/airdrop-alternative',
    '/p2p-file-transfer',
    '/transfernow-alternative',
    '/best-wetransfer-alternative-india',
  ];
  for (const aliasPath of aliasPaths) {
    assert.ok(
      !urls.includes(`https://sendtoanyone.com${aliasPath}`),
      `Alias ${aliasPath} must not be a separate sitemap URL`
    );
  }
});

test('all sitemap URLs have matching route definitions and metadata mappings in SeoHead', () => {
  const sitemap = fs.readFileSync(path.join(projectRoot, 'public/sitemap.xml'), 'utf8');
  const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/sendtoanyone\.com([^<]*)<\/loc>/g)].map(
    m => m[1] || '/'
  );

  const seoHeadContent = fs.readFileSync(path.join(projectRoot, 'functions/lib/seoRoutes.js'), 'utf8');
  const routeMapKeys = [...seoHeadContent.matchAll(/'(\/[^']*)':\s*page\(/g)].map(m => m[1]);

  const seoLandingContent = fs.readFileSync(path.join(projectRoot, 'src/pages/SeoLandingPage.jsx'), 'utf8');
  const landingSlugs = [...seoLandingContent.matchAll(/'([a-z0-9-]+)':\s*{/g)].map(m => '/' + m[1]);

  const allSupportedPaths = new Set([...routeMapKeys, ...landingSlugs]);

  for (const sitemapPath of sitemapPaths) {
    assert.ok(
      allSupportedPaths.has(sitemapPath),
      `Sitemap path ${sitemapPath} must have explicit title/description in SeoHead or SeoLandingPage`
    );
  }
});

test('SeoHead source code explicitly handles /transfers and private routes with noindex directives', () => {
  const seoHeadContent = fs.readFileSync(path.join(projectRoot, 'src/components/SeoHead.jsx'), 'utf8');

  // Verify /transfers is explicitly assigned noindex
  assert.ok(seoHeadContent.includes("currentPath === '/transfers'"), 'SeoHead must explicitly test for /transfers');
  
  // Verify private transfer pattern triggers noindex
  assert.ok(seoHeadContent.includes("isPrivateTransfer = /^\\/(d|download|request)\\//.test(currentPath)"), 'SeoHead must classify /d/, /download/, /request/');

  // Verify noindex directive values
  assert.ok(seoHeadContent.includes("updateRobots('noindex, nofollow, noarchive')"), 'SeoHead must set noindex, nofollow, noarchive');
});
