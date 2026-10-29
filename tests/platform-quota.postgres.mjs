/**
 * Disposable Postgres proof for the 1 TB platform cap and atomic download slots.
 * It does not connect to hosted Supabase or start the Docker stack.
 * The 300 GB function in 20261023004500 is replaced when the newer file is applied.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:net';

const MIGRATIONS_DIR = path.resolve('supabase/migrations');
const SHARE_MIGRATION = path.join(MIGRATIONS_DIR, '20261022193000_reserve_transfer_file.sql');
const PLATFORM_MIGRATION = path.join(MIGRATIONS_DIR, '20261023004500_platform_storage_cap_and_download_slot.sql');
const PLATFORM_LIMIT_MARKER = 'platform_limit constant bigint := 1000000000000';

function raiseMigration() {
  const matches = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8').includes(PLATFORM_LIMIT_MARKER))
    .sort();
  assert.equal(matches.length, 1, `expected one migration containing ${PLATFORM_LIMIT_MARKER}`);
  return path.join(MIGRATIONS_DIR, matches[0]);
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return result;
}

function psql(port, sql) {
  return run('psql', [
    '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-c', sql,
  ], { env: { ...process.env, PGHOST: '127.0.0.1' } });
}

function reserveSql(shareId, bytes, name) {
  return `select public.reserve_transfer_file(
    '${shareId}', '${name}', ${bytes}, 'transfers/cap-${name}',
    'application/octet-stream', null, null, null, null, null, null, null,
    'link', 0, now() + interval '1 day', 'r2'
  )::text`;
}

const PTY_BRIDGE = `
import os, sys, pty, threading
app, port = sys.argv[1], sys.argv[2]
pid, fd = pty.fork()
if pid == 0:
    os.environ['PGAPPNAME'] = app
    os.environ['PGHOST'] = '127.0.0.1'
    os.environ['PAGER'] = 'cat'
    os.environ['TERM'] = 'dumb'
    os.execvp('psql', ['psql', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-q'])
def pump():
    while True:
        try:
            data = os.read(fd, 4096)
        except OSError:
            return
        if not data:
            return
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
threading.Thread(target=pump, daemon=True).start()
for line in sys.stdin:
    os.write(fd, line.encode())
os.close(fd)
`;

function openSession(port, name) {
  const child = spawn('python3', ['-u', '-c', PTY_BRIDGE, name, String(port)], {
    env: { ...process.env, PGHOST: '127.0.0.1', PAGER: 'cat', TERM: 'dumb' },
  });
  let out = '';
  child.stdout.on('data', (chunk) => { out += chunk; });
  child.stderr.on('data', (chunk) => { out += chunk; });
  return {
    write(sql) { child.stdin.write(`${sql}\n`); },
    output() { return out; },
    close() { child.stdin.end(); child.kill(); },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(port, sql, pattern, timeoutMs = 8000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    const result = psql(port, sql);
    last = `${result.stdout}\n${result.stderr}`;
    if (result.status === 0 && pattern.test(last)) return last;
    await delay(40);
  }
  throw new Error(`timed out waiting for ${pattern}\n${last}`);
}

async function waitForSession(session, pattern, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pattern.test(session.output())) return session.output();
    await delay(40);
  }
  throw new Error(`timed out waiting for ${pattern}\n${session.output()}`);
}

async function waitForOutput(session, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (/=#/.test(session.output())) return;
    await delay(30);
  }
  throw new Error(`psql did not start\n${session.output()}`);
}

test('platform cap and download slots stay atomic on disposable Postgres', async () => {
  const port = await reservePort();
  const dir = mkdtempSync(path.join(tmpdir(), 'itransfer-platform-'));
  const logFile = path.join(dir, 'server.log');
  const sessions = [];
  try {
    const init = run('initdb', ['-D', dir, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--no-sync']);
    assert.equal(init.status, 0, init.stderr);
    const start = run('pg_ctl', ['-D', dir, '-l', logFile, '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1`, 'start']);
    assert.equal(start.status, 0, start.stderr);

    const fixture = psql(port, `
      create extension if not exists pgcrypto;
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create table public.transfers (
        id uuid primary key default gen_random_uuid(),
        share_id text not null,
        file_name text not null,
        file_size bigint not null,
        file_path text not null,
        content_type text,
        subject text,
        message text,
        sender_email text,
        recipient_emails text,
        password_hash text,
        user_id uuid,
        transfer_type text not null,
        max_downloads integer not null default 0,
        download_count integer not null default 0,
        expires_at timestamptz not null,
        status text,
        storage_provider text not null default 'r2',
        request_id text,
        created_at timestamptz not null default now()
      );
      grant all privileges on table public.transfers to service_role;
    `);
    assert.equal(fixture.status, 0, fixture.stderr);
    const migrationFiles = [SHARE_MIGRATION, PLATFORM_MIGRATION, raiseMigration()].sort();
    for (const file of migrationFiles) {
      const applied = run('psql', [
        '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', file,
      ]);
      assert.equal(applied.status, 0, `${file}\n${applied.stderr}`);
    }

    const shareFull = psql(port, `
      begin; set local role service_role;
      ${reserveSql('sharecap1', 6000000000, 'full.bin')};
      commit;
    `);
    assert.match(shareFull.stdout, /"ok": true/);
    const shareOver = psql(port, `
      begin; set local role service_role;
      ${reserveSql('sharecap1', 1, 'extra.bin')};
      commit;
    `);
    assert.match(shareOver.stdout, /TRANSFER_TOO_LARGE/);
    psql(port, `update public.transfers set status = 'released' where share_id = 'sharecap1';`);

    const seeded = psql(port, `
      insert into public.transfers (
        share_id, file_name, file_size, file_path, transfer_type, expires_at, status
      )
      select 'seed' || lpad(g::text, 4, '0'), 'seed.bin', 6000000000,
             'transfers/seed/' || g || '.bin', 'link', now() + interval '1 day',
             case when g = 165 then null else 'active' end
      from generate_series(1, 165) g;
      insert into public.transfers (
        share_id, file_name, file_size, file_path, transfer_type, expires_at, status
      ) values (
        'seedextra1', 'extra.bin', 4000000000, 'transfers/seed/extra.bin',
        'link', now() + interval '1 day', 'active'
      );
    `);
    assert.equal(seeded.status, 0, seeded.stderr);
    const occupied = psql(port, `
      select coalesce(sum(file_size), 0) from public.transfers
      where coalesce(status, 'active') not in ('rejected', 'expired', 'released');
    `);
    assert.match(occupied.stdout, /994000000000/);

    const left = openSession(port, 'cap-a');
    const right = openSession(port, 'cap-b');
    sessions.push(left, right);
    await waitForOutput(left);
    await waitForOutput(right);
    const rightWait = `
      select a.state || '|' || coalesce(a.wait_event_type, '') || '|' || coalesce(a.wait_event, '')
      from pg_stat_activity a
      where a.application_name = 'cap-b' and a.pid <> pg_backend_pid()
    `;
    left.write('begin; set local role service_role;');
    left.write(`${reserveSql('capleft01', 6000000000, 'left.bin')};`);
    await waitFor(port, `
      select state from pg_stat_activity
      where application_name = 'cap-a' and pid <> pg_backend_pid()
    `, /idle in transaction/);
    right.write('begin; set local role service_role;');
    right.write(`${reserveSql('capright1', 6000000000, 'right.bin')};`);
    await waitFor(port, rightWait, /active\|Lock\|advisory/);
    left.write('rollback;');
    await waitFor(port, rightWait, /idle in transaction\|/);
    await waitForSession(right, /"ok": true/);
    right.write('commit;');
    await waitFor(port, `select count(*) from public.transfers where file_name = 'right.bin' and status = 'pending';`, /\b1\b/);

    const blocked = psql(port, `
      begin; set local role service_role;
      ${reserveSql('capblock1', 6000000000, 'blocked.bin')};
      commit;
    `);
    assert.match(blocked.stdout, /STORAGE_CAP/);
    const blockedCount = psql(port, `select count(*) from public.transfers where file_name = 'blocked.bin';`);
    assert.match(blockedCount.stdout, /\b0\b/);

    psql(port, `update public.transfers set status = 'released' where file_name = 'right.bin';`);
    const recovered = psql(port, `
      begin; set local role service_role;
      ${reserveSql('capagain1', 6000000000, 'again.bin')};
      commit;
    `);
    assert.match(recovered.stdout, /"ok": true/);
    psql(port, `update public.transfers set status = 'pending_delete' where file_name = 'again.bin';`);
    const stillHeld = psql(port, `
      begin; set local role service_role;
      ${reserveSql('capheld01', 1, 'held.bin')};
      commit;
    `);
    assert.match(stillHeld.stdout, /STORAGE_CAP/);
    psql(port, `update public.transfers set status = 'rejected' where file_name = 'again.bin';`);
    const afterReject = psql(port, `
      begin; set local role service_role;
      ${reserveSql('capfree01', 1, 'free.bin')};
      commit;
    `);
    assert.match(afterReject.stdout, /"ok": true/);

    const file = psql(port, `
      insert into public.transfers (
        share_id, file_name, file_size, file_path, transfer_type, expires_at, status, max_downloads
      ) values (
        'downshare', 'once.txt', 10, 'transfers/down/once.txt', 'link', now() + interval '1 day', 'active', 1
      ) returning id::text;
    `);
    const fileId = file.stdout.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    assert.ok(fileId);
    const claim = `select public.claim_download_slot('${fileId}'::uuid, 'downshare')::text`;
    const claimA = openSession(port, 'down-a');
    const claimB = openSession(port, 'down-b');
    sessions.push(claimA, claimB);
    await waitForOutput(claimA);
    await waitForOutput(claimB);
    claimA.write('begin; set local role service_role;');
    claimA.write(`${claim};`);
    await waitFor(port, `
      select state from pg_stat_activity
      where application_name = 'down-a' and pid <> pg_backend_pid()
    `, /idle in transaction\n/);
    claimB.write('begin; set local role service_role;');
    claimB.write(`${claim};`);
    await waitFor(port, `
      select a.state || '|' || coalesce(a.wait_event_type, '') || '|' || coalesce(a.wait_event, '')
      from pg_stat_activity a
      where a.application_name = 'down-b' and a.pid <> pg_backend_pid()
    `, /active\|Lock\|/);
    claimA.write('commit;');
    await waitFor(port, `select download_count from public.transfers where id = '${fileId}';`, /\b1\b/);
    await waitForSession(claimB, /DOWNLOAD_LIMIT/);
    claimB.write('commit;');
    const once = psql(port, `select download_count from public.transfers where id = '${fileId}';`);
    assert.match(once.stdout, /\b1\b/);

    const released = psql(port, `select public.release_download_slot('${fileId}'::uuid, 'downshare')::text;`);
    assert.match(released.stdout, /"download_count": 0/);
    const again = psql(port, `begin; set local role service_role; ${claim}; commit;`);
    assert.match(again.stdout, /"ok": true/);

    const openEnded = psql(port, `
      update public.transfers set max_downloads = 0, download_count = 0 where id = '${fileId}';
      select public.claim_download_slot('${fileId}'::uuid, 'downshare')::text;
    `);
    assert.match(openEnded.stdout, /"download_count": 1/);

    const expired = psql(port, `
      update public.transfers set expires_at = now() - interval '1 minute', download_count = 4 where id = '${fileId}';
      select public.claim_download_slot('${fileId}'::uuid, 'downshare')::text;
    `);
    assert.match(expired.stdout, /EXPIRED/);
    const unchanged = psql(port, `select download_count from public.transfers where id = '${fileId}';`);
    assert.match(unchanged.stdout, /\b4\b/);

    const anon = psql(port, `begin; set local role anon; ${claim}; commit;`);
    assert.match(`${anon.stderr}\n${anon.stdout}`, /permission denied/i);
  } finally {
    for (const session of sessions) session.close();
    run('pg_ctl', ['-D', dir, '-m', 'immediate', 'stop']);
  }
});
