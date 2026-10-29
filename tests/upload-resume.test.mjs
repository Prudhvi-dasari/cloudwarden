import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bytesFromCompletedParts,
  partCountFor,
  partsStillNeeded,
} from '../src/lib/uploadPlan.js';
import {
  identitiesMatch,
  matchResumeSession,
  sessionIsResumable,
  sessionProgress,
} from '../src/lib/uploadPersistence.js';
import { storageAdmission, storageCapBytes, guestDailyBytes } from '../functions/lib/storagePolicy.js';

const PART = 16 * 1024 * 1024;

test('resume skips parts that already finished and keeps their bytes', () => {
  const total = 50 * 1024 * 1024;
  const count = partCountFor(total, PART);
  assert.equal(count, 4);
  const done = [1, 2];
  assert.deepEqual(partsStillNeeded(count, done), [3, 4]);
  assert.equal(bytesFromCompletedParts(total, done, PART), 2 * PART);
  assert.equal(bytesFromCompletedParts(total, [1, 2, 3, 4], PART), total);
});

test('a saved upload matches only the same file and ignores an expired one', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  const file = { name: 'clip.mov', size: 40_000_000, lastModified: 100 };
  const session = {
    shareId: 'clip01',
    deleteToken: 'token',
    savedAt: '2026-10-29T11:00:00Z',
    expiresAt: '2026-11-05T11:00:00Z',
    files: [{ name: 'clip.mov', size: 40_000_000, lastModified: 100, uploadId: 'up-1', uploadedBytes: 16_000_000 }],
  };
  assert.equal(identitiesMatch(session.files[0], file), true);
  assert.equal(identitiesMatch(session.files[0], { ...file, size: 1 }), false);
  assert.equal(sessionIsResumable(session, now), true);
  assert.equal(matchResumeSession([session], [file], now)?.shareId, 'clip01');
  assert.equal(sessionProgress(session) > 0, true);
  const stale = { ...session, savedAt: '2026-10-28T00:00:00Z' };
  assert.equal(sessionIsResumable(stale, now), false);
  assert.equal(matchResumeSession([stale], [file], now), null);
});

test('storage cap blocks everyone at 2 TB and free sends at 90 percent', () => {
  const cap = storageCapBytes({});
  assert.equal(cap, 2_000_000_000_000);
  assert.equal(storageCapBytes({ STORAGE_GLOBAL_CAP_BYTES: '5000000000000' }), 5_000_000_000_000);
  assert.equal(guestDailyBytes({}), 30_000_000_000);
  const soft = Math.floor(cap * 0.9);
  assert.equal(storageAdmission({ occupied: soft, incoming: 1, cap, paid: false }).code, 'STORAGE_BUSY');
  assert.equal(storageAdmission({ occupied: soft, incoming: 1, cap, paid: true }).ok, true);
  assert.equal(storageAdmission({ occupied: cap, incoming: 1, cap, paid: true }).code, 'STORAGE_CAP');
  assert.equal(storageAdmission({ occupied: 0, incoming: cap, cap, paid: false }).code, 'STORAGE_BUSY');
  assert.equal(storageAdmission({ occupied: 0, incoming: 6_000_000_000, cap, paid: false }).ok, true);
});
