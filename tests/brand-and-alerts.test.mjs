import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicBrand, sanitizeAccent, sanitizeBrandMessage, sanitizeHttpsUrl } from '../functions/lib/brandStyle.js';
import { alertToken, shouldSendDownloadAlert } from '../functions/lib/downloadAlert.js';
import { cheerBudget, CHEER_MS, spawnBurst, stepPieces } from '../src/lib/linkCheer.js';

test('branding rejects injection and keeps readable text', () => {
  assert.equal(sanitizeHttpsUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeHttpsUrl('https://user:pass@cdn.example/a.png'), '');
  assert.equal(sanitizeHttpsUrl('https://cdn.example/a.png'), 'https://cdn.example/a.png');
  assert.equal(sanitizeBrandMessage('<script>alert(1)</script> hello'), 'scriptalert(1)/script hello');
  assert.equal(sanitizeAccent('#ffffff'), null);
  assert.equal(sanitizeAccent('#1769f5')?.ink, '#060a12');
  assert.equal(sanitizeAccent('red'), null);
  const brand = publicBrand({
    brand_accent: '#1769f5',
    brand_background_url: 'https://cdn.example/bg.jpg',
    brand_message: 'Thanks',
    brand_logo_url: 'https://cdn.example/logo.png',
  });
  assert.equal(brand.brandAccent, '#1769f5');
  assert.equal(brand.brandMessage, 'Thanks');
  assert.equal(String(brand.brandBackground).includes('expression'), false);
});

test('download mail follows first, every, and opt-out', async () => {
  assert.equal(shouldSendDownloadAlert({ mode: 'first', downloadCount: 1 }), true);
  assert.equal(shouldSendDownloadAlert({ mode: 'first', downloadCount: 2 }), false);
  assert.equal(shouldSendDownloadAlert({ mode: 'each', downloadCount: 3 }), true);
  assert.equal(shouldSendDownloadAlert({ mode: 'off', downloadCount: 1 }), false);
  assert.equal(shouldSendDownloadAlert({ mode: 'first', downloadCount: 1, optedOut: true }), false);
  const token = await alertToken('secret', 'Sender@Example.com');
  assert.equal(token, await alertToken('secret', 'sender@example.com'));
  assert.notEqual(token, await alertToken('other', 'sender@example.com'));
  assert.equal(token.length, 64);
});

test('the celebration fires two cannons then a shower and falls with gravity', () => {
  assert.equal(cheerBudget(400), 68);
  assert.equal(cheerBudget(1200), 118);
  assert.ok(CHEER_MS >= 2500 && CHEER_MS <= 3500);
  let n = 0;
  const rand = () => {
    n += 1;
    return (n % 7) / 7;
  };
  const cannons = spawnBurst({ width: 1000, height: 800, phase: 'cannons', budget: 100, rand });
  const shower = spawnBurst({ width: 1000, height: 800, phase: 'shower', budget: 100, rand });
  assert.ok(cannons.some((item) => item.x < 100));
  assert.ok(cannons.some((item) => item.x > 900));
  assert.ok(cannons.some((item) => item.kind === 'ribbon'));
  assert.ok(shower.every((item) => item.y < 0));
  const still = [{ kind: 'rect', x: 0, y: 0, vx: 0, vy: 0, drag: 0, flutter: 0, spin: 0 }];
  stepPieces(still, 0.2);
  assert.ok(still[0].vy > 0);
  assert.ok(still[0].y > 0);
  assert.ok(cannons.length <= 100);
});
