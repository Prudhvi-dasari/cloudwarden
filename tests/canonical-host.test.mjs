import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALIAS_TO,
  CANONICAL_ORIGIN,
  INDEXABLE_PATHS,
  documentSeo,
  redirectLocation,
  rewriteDocumentHtml,
} from '../functions/lib/canonicalHost.js';

const projectRoot = path.resolve(import.meta.dirname, '..');

function loadSeoHead() {
  const source = fs.readFileSync(path.join(projectRoot, 'src/components/SeoHead.jsx'), 'utf8');
  const start = source.indexOf('export const CANONICAL_ORIGIN');
  const end = source.indexOf('function removeMeta');
  const slice = source.slice(start, end).replace(/^export /gm, '');
  return new Function(`${slice}\nreturn { CANONICAL_ORIGIN, INDEXABLE_PATHS, ALIAS_TO, canonicalUrlForPath, resolveSeo };`)();
}

const shell = `<!doctype html>
<link rel="canonical" href="https://sendtoanyone.com/" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<meta property="og:url" content="https://sendtoanyone.com/" />
<meta name="twitter:url" content="https://sendtoanyone.com/" />
<script type="application/ld+json" id="sendtoanyone-jsonld">
{"@graph":[{"url":"https://sendtoanyone.com"}]}
</script>
`;

test('edge canonical lists match SeoHead', () => {
  const seo = loadSeoHead();
  assert.equal(CANONICAL_ORIGIN, 'https://sendtoanyone.com');
  assert.deepEqual(INDEXABLE_PATHS, seo.INDEXABLE_PATHS);
  assert.deepEqual(ALIAS_TO, seo.ALIAS_TO);
});

test('legacy hosts and trailing slashes 301 to the canonical URL', () => {
  assert.equal(
    redirectLocation('https://itransfer.iprudhvi.in/d/7czhzqbn', 'GET'),
    'https://sendtoanyone.com/d/7czhzqbn',
  );
  assert.equal(
    redirectLocation('https://www.sendtoanyone.com/pricing/?plan=year', 'HEAD'),
    'https://sendtoanyone.com/pricing?plan=year',
  );
  assert.equal(
    redirectLocation('https://sendtoanyone.com/features/', 'GET'),
    'https://sendtoanyone.com/features',
  );
  assert.equal(redirectLocation('https://sendtoanyone.com/', 'GET'), null);
  assert.equal(redirectLocation('https://sendtoanyone.com/pricing', 'GET'), null);
  assert.equal(redirectLocation('https://itransfer.iprudhvi.in/api/r2?action=cleanup', 'POST'), null);
  assert.equal(redirectLocation('https://preview.itransfer-app.pages.dev/pricing/', 'GET'), null);
});

test('the HTML shell gets a self canonical on public pages and noindex on transfers', () => {
  const pricing = rewriteDocumentHtml('/pricing', shell);
  assert.match(pricing, /<link rel="canonical" href="https:\/\/sendtoanyone.com\/pricing" \/>/);
  assert.match(pricing, /property="og:url" content="https:\/\/sendtoanyone.com\/pricing"/);
  assert.equal(pricing.includes('sendtoanyone-jsonld'), false);
  assert.equal(pricing.includes('https://sendtoanyone.com/"'), false);

  const home = rewriteDocumentHtml('/', shell);
  assert.match(home, /<link rel="canonical" href="https:\/\/sendtoanyone.com\/" \/>/);
  assert.match(home, /id="sendtoanyone-jsonld"/);

  const download = rewriteDocumentHtml('/d/7czhzqbn', shell);
  assert.equal(download.includes('rel="canonical"'), false);
  assert.match(download, /noindex, nofollow, noarchive/);

  const alias = documentSeo('/contact');
  assert.equal(alias.canonical, 'https://sendtoanyone.com/help');
  assert.match(alias.robots, /^noindex/);

  for (const routePath of INDEXABLE_PATHS) {
    const decision = documentSeo(routePath);
    assert.equal(decision.canonical, routePath === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${routePath}`);
    assert.match(decision.robots, /^index, follow/);
  }
});
