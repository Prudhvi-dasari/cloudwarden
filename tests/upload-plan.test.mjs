import test from 'node:test';
import assert from 'node:assert/strict';
import { PART_SIZE_BYTES, SINGLE_PUT_MAX_BYTES, uploadNeedsMultipart } from '../src/lib/uploadPlan.js';

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
