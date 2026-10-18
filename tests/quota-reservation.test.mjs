import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { canReserve, GB, STORAGE_POLICY } from '../functions/lib/storagePolicy.js';

function openLedger() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE storage_ledger (
      id INTEGER PRIMARY KEY,
      committed_bytes INTEGER NOT NULL,
      reserved_bytes INTEGER NOT NULL,
      quota_bytes INTEGER NOT NULL
    );
    INSERT INTO storage_ledger (id, committed_bytes, reserved_bytes, quota_bytes)
    VALUES (1, ${14 * GB}, 0, ${20 * GB});
    CREATE TABLE upload_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      object_key TEXT UNIQUE,
      reserved_bytes INTEGER NOT NULL,
      status TEXT NOT NULL
    );
  `);
  return db;
}

function reserve(db, bytes, key) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT committed_bytes, reserved_bytes, quota_bytes FROM storage_ledger WHERE id = 1').get();
    if (!canReserve(row, bytes)) {
      db.exec('ROLLBACK');
      return false;
    }
    db.prepare('UPDATE storage_ledger SET reserved_bytes = reserved_bytes + ? WHERE id = 1').run(bytes);
    db.prepare(`INSERT INTO upload_reservations (object_key, reserved_bytes, status) VALUES (?, ?, 'RESERVED')`).run(key, bytes);
    db.exec('COMMIT');
    return true;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* already closed */ }
    throw err;
  }
}

test('guest and account limits use decimal gigabytes', () => {
  assert.equal(STORAGE_POLICY.guestMaxBytes, 6_000_000_000);
  assert.equal(STORAGE_POLICY.freeTransferBytes, 6_000_000_000);
  assert.equal(STORAGE_POLICY.paidFeaturesEnabled, false);
  assert.equal(STORAGE_POLICY.quotaBytes, 7_000_000_000);
  assert.equal(GB, 1_000_000_000);
});

test('two simultaneous 6GB reservations against 14GB committed and a 20GB quota: exactly one succeeds', () => {
  const db = openLedger();
  const quota = 20 * GB;
  const results = [reserve(db, 6 * GB, 'a'), reserve(db, 6 * GB, 'b')];
  const wins = results.filter(Boolean).length;
  const row = db.prepare('SELECT committed_bytes, reserved_bytes, quota_bytes FROM storage_ledger WHERE id = 1').get();
  assert.equal(wins, 1);
  assert.equal(row.committed_bytes + row.reserved_bytes, 20 * GB);
  assert.ok(row.committed_bytes + row.reserved_bytes <= quota);
  assert.equal(db.prepare('SELECT count(*) AS n FROM upload_reservations').get().n, 1);
});

test('a repeated reservation of the same object key does not add quota twice', () => {
  const db = openLedger();
  assert.equal(reserve(db, 1 * GB, 'same'), true);
  assert.throws(() => reserve(db, 1 * GB, 'same'));
  const row = db.prepare('SELECT reserved_bytes FROM storage_ledger WHERE id = 1').get();
  assert.equal(row.reserved_bytes, 1 * GB);
});
