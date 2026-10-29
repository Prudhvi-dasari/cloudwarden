import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { canReserve, GB, STORAGE_POLICY } from '../functions/lib/storagePolicy.js';
import { FREE_TRANSFER_BYTES, PLATFORM_QUOTA_BYTES, reserveInto } from '../functions/lib/transferReservation.js';

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
  assert.equal(STORAGE_POLICY.paidTransferBytes, 250_000_000_000);
  assert.equal(STORAGE_POLICY.paidRetentionHours, 180 * 24);
  assert.equal(STORAGE_POLICY.paidFeaturesEnabled, true);
  assert.equal(STORAGE_POLICY.quotaBytes, 7_000_000_000);
  assert.equal(STORAGE_POLICY.platformQuotaBytes, 1000000000000);
  assert.equal(GB, 1_000_000_000);
});

function reserveBody(bytes, shareId) {
  return {
    p_share_id: shareId,
    p_file_name: 'file.bin',
    p_file_size: bytes,
    p_file_path: `transfers/${shareId}/file.bin`,
    p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

test('the whole-platform cap is 1 TB and the share cap stays 6 GB', () => {
  assert.equal(STORAGE_POLICY.platformQuotaBytes, 1000000000000);
  assert.equal(STORAGE_POLICY.quotaBytes, 7_000_000_000);
  assert.equal(STORAGE_POLICY.freeTransferBytes, 6_000_000_000);
  assert.equal(STORAGE_POLICY.guestMaxBytes, 6_000_000_000);
  assert.equal(STORAGE_POLICY.paidFeaturesEnabled, true);
  assert.equal(PLATFORM_QUOTA_BYTES, 1000000000000);
  assert.equal(FREE_TRANSFER_BYTES, 6000000000);

  const overShare = reserveInto([], reserveBody(6000000001, 'share-over'), 'over');
  assert.equal(overShare.ok, false);
  assert.equal(overShare.code, 'TRANSFER_TOO_LARGE');

  const emptyPlatform = reserveInto([], reserveBody(6000000000, 'share-empty'), 'empty');
  assert.equal(emptyPlatform.ok, true);

  const rows = [{ share_id: 'occupied', file_size: 999999999999, status: 'active' }];
  const exactly = reserveInto(rows, reserveBody(1, 'share-edge'), 'edge');
  assert.equal(exactly.ok, true);
  const nextByte = reserveInto(rows, reserveBody(1, 'share-next'), 'next');
  assert.equal(nextByte.ok, false);
  assert.equal(nextByte.code, 'STORAGE_CAP');

  for (const status of ['rejected', 'expired', 'released']) {
    const allowed = reserveInto(
      [{ share_id: 'full', file_size: 1000000000000, status }],
      reserveBody(1, 'share-free'),
      status,
    );
    assert.equal(allowed.ok, true, status);
  }

  for (const status of ['pending_delete', null]) {
    const blocked = reserveInto(
      [{ share_id: 'full', file_size: 1000000000000, status }],
      reserveBody(1, 'share-held'),
      String(status),
    );
    assert.equal(blocked.ok, false, String(status));
    assert.equal(blocked.code, 'STORAGE_CAP');
  }
});

test('the paid allowance keeps the 1 TB platform cap and the 6 GB free share', () => {
  const root = new URL('..', import.meta.url);
  const migrationsDir = new URL('supabase/migrations/', root);
  const names = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
  const marker = 'platform_limit constant bigint := 1000000000000';
  const matches = names.filter((name) => readFileSync(new URL(name, migrationsDir), 'utf8').includes(marker)).sort();
  assert.deepEqual(matches, [
    '20261023093633_raise_platform_storage_cap.sql',
    '20261029120000_paid_transfer_allowance.sql',
  ]);
  const source = readFileSync(new URL(matches[1], migrationsDir), 'utf8');
  assert.match(source, /free_limit constant bigint := 6000000000/);
  assert.match(source, /paid_limit constant bigint := 250000000000/);
  assert.match(source, /4320/);
  assert.match(source, /itransfer-platform-v1/);
  assert.match(source, /security invoker/);
  assert.match(source, /search_path/);
  assert.match(source, /STORAGE_CAP/);
  assert.match(source, /TRANSFER_TOO_LARGE/);
  assert.doesNotMatch(source, /claim_download_slot/);
  assert.doesNotMatch(source, /release_download_slot/);
  assert.doesNotMatch(source, /300000000000/);

  const historical = readFileSync(
    new URL('20261023004500_platform_storage_cap_and_download_slot.sql', migrationsDir),
    'utf8',
  );
  assert.match(historical, /300000000000/);
  assert.doesNotMatch(historical, /1000000000000/);

  const verify = readFileSync(new URL('supabase/testing/production-sql-verify.sql', root), 'utf8');
  assert.match(verify, /platform_limit constant bigint := 1000000000000/);
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
