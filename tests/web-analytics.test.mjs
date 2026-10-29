import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('one Web Analytics beacon stays independent of the application', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
  const beacons = html.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || [];
  assert.equal(beacons.length, 1);
  assert.match(html, /<script type="module" src="\/src\/main\.jsx"><\/script>/);
  assert.match(
    html,
    /<script type='module' src='https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js' data-cf-beacon='\{"token": "[a-f0-9]{32}"\}'><\/script>/,
  );
  assert.equal(html.includes('"spa": false'), false);
  assert.equal(html.includes('"spa":false'), false);
  assert.match(html, /<link rel="canonical" href="https:\/\/sendtoanyone\.com\/" \/>/);
  assert.match(app, /<BrowserRouter>/);
  assert.equal(app.includes('cloudflareinsights'), false);
  assert.equal(fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8').includes('cloudflareinsights'), false);
});

test('every Worker config enables observability without turning it on live', () => {
  const files = [
    'wrangler.jsonc',
    'wrangler.rate-limit.jsonc',
    'wrangler.cleanup.jsonc',
    'wrangler.rate-limit.preview.jsonc',
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(text, /"observability"\s*:\s*\{\s*"enabled"\s*:\s*true\s*\}/);
  }
});
