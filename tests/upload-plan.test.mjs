import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PART_SIZE_BYTES,
  PART_UPLOAD_ATTEMPTS,
  PART_URL_MAX_AGE_MS,
  SINGLE_PUT_MAX_BYTES,
  normalizePartEtag,
  partUrlIsStale,
  uploadNeedsMultipart,
} from '../src/lib/uploadPlan.js';

test('files near the 6 GB limit use multipart instead of one PUT', () => {
  assert.equal(SINGLE_PUT_MAX_BYTES, 8 * 1024 * 1024);
  assert.ok(PART_SIZE_BYTES >= 5 * 1024 * 1024);
  assert.equal(uploadNeedsMultipart(SINGLE_PUT_MAX_BYTES), false);
  assert.equal(uploadNeedsMultipart(SINGLE_PUT_MAX_BYTES + 1), true);
  assert.equal(uploadNeedsMultipart(5 * 1024 * 1024 * 1024), true);
  assert.equal(uploadNeedsMultipart(6_000_000_000), true);
  assert.equal(uploadNeedsMultipart(0), false);
  assert.equal(uploadNeedsMultipart(Number.NaN), false);
});

test('part URLs refresh before the 15 minute signature expires, and etags stay optional', () => {
  assert.equal(PART_UPLOAD_ATTEMPTS, 6);
  assert.ok(PART_URL_MAX_AGE_MS < 15 * 60 * 1000);
  const now = 1_000_000;
  assert.equal(partUrlIsStale(now - PART_URL_MAX_AGE_MS, now), true);
  assert.equal(partUrlIsStale(now - 1000, now), false);
  assert.equal(partUrlIsStale(0, now), true);
  assert.equal(normalizePartEtag(''), '');
  assert.equal(normalizePartEtag('abc'), '"abc"');
  assert.equal(normalizePartEtag('"abc"'), '"abc"');
});
