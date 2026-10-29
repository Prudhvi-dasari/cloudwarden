/**
 * Real PostgreSQL concurrency test for share reservations.
 *
 * This is not a mock and it does not connect to hosted Supabase.
 * It creates a temporary local cluster, applies only
 * supabase/migrations/20261022193000_reserve_transfer_file.sql,
 * and holds two transactions open at the same time. The second call must
 * wait on the advisory lock until the first commits.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:net';

const MIGRATION = path.resolve('supabase/migrations/20261022193000_reserve_transfer_file.sql');

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
    '-h', '127.0.0.1',
    '-p', String(port),
    '-U', 'postgres',
    '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-X',
    '-q',
    '-c', sql,
  ], { env: { ...process.env, PGHOST: '127.0.0.1' } });
}

function reserveSql(shareId, bytes, name) {
  return `select public.reserve_transfer_file(
    '${shareId}',
    '${name}',
    ${bytes},
    'transfers/900-${name}',
    'application/octet-stream',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'link',
    0,
    now() + interval '1 day',
    'r2'
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
  let exited = null;
  child.stdout.on('data', (chunk) => { out += chunk; });
  child.stderr.on('data', (chunk) => { out += chunk; });
  child.on('exit', (code) => { exited = code; });
  return {
    write(sql) {
      if (exited !== null) throw new Error(`${name} exited ${exited}\n${out}`);
      child.stdin.write(`${sql}\n`);
    },
    output() { return out; },
    close() {
      child.stdin.end();
      child.kill();
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(port, sql, pattern, timeoutMs = 5000) {
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

async function waitForOutput(session, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (/=#/.test(session.output())) return;
    await delay(30);
  }
  throw new Error(`psql did not start\n${session.output()}`);
}

test('real PostgreSQL: overlapping reservations lock one share and keep the 6 GB cap', async () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /6000000000/);
  assert.match(sql, /'rejected', 'expired', 'released'/);

  const port = await reservePort();
  const dir = mkdtempSync(path.join(tmpdir(), 'itransfer-reserve-'));
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
        status text not null default 'active',
        storage_provider text not null default 'r2',
        request_id text,
        multipart_upload_id text,
        created_at timestamptz not null default now()
      );
      alter table public.transfers enable row level security;
      alter table public.transfers force row level security;
      grant all privileges on table public.transfers to service_role;
      insert into public.transfers (
        share_id, file_name, file_size, file_path, transfer_type, expires_at, status
      ) values
        ('legacy01', 'keep.txt', 12, 'transfers/legacy/keep.txt', 'link', now() + interval '1 day', 'active'),
        ('legacy01', 'old.txt', 9, 'transfers/legacy/old.txt', 'link', now() + interval '1 day', 'rejected');
    `);
    assert.equal(fixture.status, 0, fixture.stderr);

    const applied = run('psql', [
      '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres',
      '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', MIGRATION,
    ]);
    assert.equal(applied.status, 0, applied.stderr);

    const denied = psql(port, `
      begin;
      set local role anon;
      ${reserveSql('denied01', 1, 'nope.bin')};
      commit;
    `);
    assert.notEqual(denied.status, 0, denied.stdout);
    assert.match(`${denied.stderr}\n${denied.stdout}`, /permission denied/i);

    const exact = psql(port, `
      begin;
      set local role service_role;
      ${reserveSql('exact0001', 6000000000, 'full.bin')};
      commit;
    `);
    assert.equal(exact.status, 0, exact.stderr);
    assert.match(exact.stdout, /"ok": true/);
    const stored = psql(port, `select file_name, file_size, status from public.transfers where share_id = 'exact0001';`);
    assert.equal(stored.status, 0, stored.stderr);
    assert.match(stored.stdout, /full\.bin/);
    assert.match(stored.stdout, /6000000000/);

    const overOne = psql(port, `
      begin;
      set local role service_role;
      ${reserveSql('exact0001', 1, 'extra.bin')};
      commit;
    `);
    assert.equal(overOne.status, 0, overOne.stderr);
    assert.match(overOne.stdout, /TRANSFER_TOO_LARGE/);
    const exactCount = psql(port, `select count(*) from public.transfers where share_id = 'exact0001';`);
    assert.match(exactCount.stdout, /\b1\b/);

    const legacy = psql(port, `
      begin;
      set local role service_role;
      ${reserveSql('legacy01', 5999999988, 'beside.bin')};
      commit;
    `);
    assert.match(legacy.stdout, /"ok": true/);
    const legacyCount = psql(port, `
      select count(*) filter (where status = 'pending') as pending_rows,
             count(*) filter (where status = 'rejected') as rejected_rows,
             count(*) filter (where status = 'active') as active_rows
      from public.transfers where share_id = 'legacy01';
    `);
    assert.equal(legacyCount.status, 0, legacyCount.stderr);
    assert.match(legacyCount.stdout, /1\s+\|\s+1\s+\|\s+1/);

    const left = openSession(port, 'reserve-a');
    const right = openSession(port, 'reserve-b');
    sessions.push(left, right);
    await waitForOutput(left);
    await waitForOutput(right);

    const heldLock = `
      select a.state || '|' || coalesce(l.granted::text, 'false')
      from pg_stat_activity a
      left join pg_locks l on l.pid = a.pid and l.locktype = 'advisory'
      where a.application_name = 'reserve-a' and a.pid <> pg_backend_pid()
    `;
    const rightWait = `
      select a.state || '|' || coalesce(a.wait_event_type, '') || '|' || coalesce(a.wait_event, '')
      from pg_stat_activity a
      where a.application_name = 'reserve-b' and a.pid <> pg_backend_pid()
    `;

    left.write('begin;');
    left.write(`${reserveSql('overlap1', 4000000000, 'left.bin')};`);
    await waitFor(port, heldLock, /idle in transaction\|true/);

    right.write('begin;');
    right.write(`${reserveSql('overlap1', 3000000000, 'right.bin')};`);
    const waiting = await waitFor(port, rightWait, /active\|Lock\|advisory/);
    assert.match(waiting, /advisory/);
    const hidden = psql(port, `select count(*) from public.transfers where file_name = 'right.bin';`);
    assert.match(hidden.stdout, /\b0\b/);

    left.write('commit;');
    await waitFor(port, rightWait, /idle in transaction\|/);
    right.write('commit;');

    const overlapCount = psql(port, `
      select count(*), coalesce(sum(file_size), 0)
      from public.transfers
      where share_id = 'overlap1' and status = 'pending';
    `);
    assert.equal(overlapCount.status, 0, overlapCount.stderr);
    assert.match(overlapCount.stdout, /1\s+\|\s+4000000000/);
    const noRight = psql(port, `select count(*) from public.transfers where file_name = 'right.bin';`);
    assert.match(noRight.stdout, /\b0\b/);

    left.write('begin;');
    left.write(`${reserveSql('exactover', 3000000000, 'half-a.bin')};`);
    await waitFor(port, heldLock, /idle in transaction\|true/);
    right.write('begin;');
    right.write(`${reserveSql('exactover', 3000000000, 'half-b.bin')};`);
    await waitFor(port, rightWait, /active\|Lock\|advisory/);
    left.write('commit;');
    await waitFor(port, rightWait, /idle in transaction\|/);
    right.write('commit;');
    await waitFor(port, rightWait, /idle\|/);

    const six = psql(port, `
      select count(*), coalesce(sum(file_size), 0)
      from public.transfers
      where share_id = 'exactover' and status = 'pending';
    `);
    assert.equal(six.status, 0, `${six.stderr}\n${left.output()}\n${right.output()}`);
    assert.match(six.stdout, /2\s+\|\s+6000000000/);

    const preserved = psql(port, `
      select file_name, file_path, status from public.transfers where share_id = 'legacy01' order by file_name;
    `);
    assert.match(preserved.stdout, /keep\.txt/);
    assert.match(preserved.stdout, /transfers\/legacy\/keep\.txt/);
    assert.match(preserved.stdout, /old\.txt/);
  } finally {
    for (const session of sessions) session.close();
    run('pg_ctl', ['-D', dir, '-m', 'immediate', 'stop']);
    rmSync(dir, { recursive: true, force: true });
  }
});
