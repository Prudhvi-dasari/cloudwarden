import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hashPassword,
  passwordMatches,
  passwordNeedsUpgrade,
  sha256Hex,
  timingSafeEqual,
} from '../functions/lib/transferSecurity.js';

test('a legacy unsalted SHA-256 password still matches and is marked for upgrade', async () => {
  const legacy = await sha256Hex('correct-horse');
  assert.equal(await passwordMatches(legacy, 'correct-horse'), true);
  assert.equal(await passwordMatches(legacy, 'wrong-horse'), false);
  assert.equal(await passwordMatches(legacy, legacy), false);
  assert.equal(passwordNeedsUpgrade(legacy), true);
});

test('an older row that stored the password itself still matches that password', async () => {
  assert.equal(await passwordMatches('plain-secret', 'plain-secret'), true);
  assert.equal(await passwordMatches('plain-secret', 'other'), false);
  assert.equal(passwordNeedsUpgrade('plain-secret'), true);
});

test('PBKDF2 hashes are salted, versioned, and compared without accepting the stored text', async () => {
  const stored = await hashPassword('correct-horse', { iterations: 10_000 });
  assert.match(stored, /^pbkdf2-sha256\$10000\$/);
  assert.equal(passwordNeedsUpgrade(stored), false);
  assert.equal(await passwordMatches(stored, 'correct-horse'), true);
  assert.equal(await passwordMatches(stored, 'wrong-horse'), false);
  assert.equal(await passwordMatches(stored, stored), false);
  const again = await hashPassword('correct-horse', { iterations: 10_000 });
  assert.notEqual(stored, again);
});

test('a truncated or too-cheap PBKDF2 row does not match', async () => {
  assert.equal(await passwordMatches('pbkdf2-sha256$10000$YQ$YQ', 'correct-horse'), false);
  assert.equal(await passwordMatches('pbkdf2-sha256$10$YQ$YQ', 'correct-horse'), false);
  assert.equal(await passwordMatches('', 'correct-horse'), false);
  assert.equal(await passwordMatches('abc', ''), false);
});

test('timingSafeEqual accepts equal strings and rejects different lengths', () => {
  assert.equal(timingSafeEqual('abcd', 'abcd'), true);
  assert.equal(timingSafeEqual('abcd', 'abce'), false);
  assert.equal(timingSafeEqual('abcd', 'abc'), false);
});
