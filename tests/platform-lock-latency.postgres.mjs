/**
 * Local timing for the platform-wide reservation lock.
 * Disposable Postgres only. It does not connect to hosted Supabase.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:net';

const SHARE_MIGRATION = path.resolve('supabase/migrations/20261022193000_reserve_transfer_file.sql');
const PLATFORM_MIGRATION = path.resolve('supabase/migrations/20261023004500_platform_storage_cap_and_download_slot.sql');
const RAISE_MIGRATION = path.resolve('supabase/migrations/20261023093633_raise_platform_storage_cap.sql');
const OCCUPIED_ROWS = 100_000;

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

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

function psql(port, sql) {
  return run('psql', [
    '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-c', sql,
  ]);
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

async function waitForOutput(session, marker, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (session.output().includes(marker)) return;
    await delay(30);
  }
  throw new Error(`timed out waiting for ${marker}\n${session.output()}`);
}

function reserveSql(shareId, name) {
  return `select public.reserve_transfer_file(
    '${shareId}', '${name}', 1, 'transfers/latency/${name}',
    'application/octet-stream', null, null, null, null, null, null, null,
    'link', 0, now() + interval '1 day', 'r2'
  )::text`;
}

test('platform reservation stays responsive with 100000 occupied rows', async () => {
  const port = await reservePort();
  const dir = mkdtempSync(path.join(tmpdir(), 'itransfer-lock-'));
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
    for (const file of [SHARE_MIGRATION, PLATFORM_MIGRATION, RAISE_MIGRATION]) {
      const applied = run('psql', [
        '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', file,
      ]);
      assert.equal(applied.status, 0, `${file}\n${applied.stderr}`);
    }

    const seeded = psql(port, `
      insert into public.transfers (
        share_id, file_name, file_size, file_path, transfer_type, expires_at, status
      )
      select 'occupied-' || g, 'file.bin', 1, 'transfers/occupied-' || g || '/file.bin', 'link',
             now() + interval '1 day', 'active'
      from generate_series(1, ${OCCUPIED_ROWS}) as g;
    `);
    assert.equal(seeded.status, 0, seeded.stderr);
    const analyzed = psql(port, 'analyze public.transfers;');
    assert.equal(analyzed.status, 0, analyzed.stderr);

    const timed = run('psql', [
      '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres',
      '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t', '-F', '|', '-c', `
      begin;
      set local role service_role;
      with started as (select clock_timestamp() as t)
      select public.reserve_transfer_file(
        'latency-share', 'one.bin', 1, 'transfers/latency/one.bin',
        'application/octet-stream', null, null, null, null, null, null, null,
        'link', 0, now() + interval '1 day', 'r2'
      )::text,
      round(extract(milliseconds from clock_timestamp() - started.t)::numeric, 3)
      from started;
      commit;
    `,
    ]);
    assert.equal(timed.status, 0, timed.stderr);
    assert.match(timed.stdout, /"ok": true/);
    const line = timed.stdout.split('\n').find((item) => item.includes('"ok"'));
    assert.ok(line, timed.stdout);
    const elapsed = Number(line.split('|').pop());
    console.log(`platform reservation ${elapsed} ms across ${OCCUPIED_ROWS} occupied rows`);
    assert.ok(elapsed < 5000, `reservation took ${elapsed} ms across ${OCCUPIED_ROWS} occupied rows`);

    const plan = psql(port, `
      explain (analyze, buffers, format text)
      select coalesce(sum(file_size), 0)
      from public.transfers
      where coalesce(status, 'active') not in ('rejected', 'expired', 'released');
    `);
    assert.equal(plan.status, 0, plan.stderr);
    assert.match(plan.stdout, /Execution Time: ([0-9.]+) ms/);
    const scan = plan.stdout.match(/Execution Time: ([0-9.]+) ms/);
    const planLines = plan.stdout.split('\n').filter((item) => /Scan|Execution Time|Aggregate/.test(item));
    for (const item of planLines) console.log(item.trim());
    assert.ok(Number(scan[1]) < 2000, plan.stdout);

    const holder = openSession(port, 'lock-holder');
    const waiter = openSession(port, 'lock-waiter');
    sessions.push(holder, waiter);
    await waitForOutput(holder, '=#');
    await waitForOutput(waiter, '=#');
    holder.write('begin; set local role service_role;');
    holder.write(`${reserveSql('lock-holder', 'holder.bin')};`);
    await waitForOutput(holder, '"ok": true');
    const waitStarted = Date.now();
    waiter.write('begin; set local role service_role;');
    waiter.write(`${reserveSql('lock-waiter', 'waiter.bin')};`);
    await waitFor(port, `
      select wait_event_type || '/' || wait_event
      from pg_stat_activity
      where application_name = 'lock-waiter' and state = 'active';
    `, /Lock\/advisory/);
    const observedWaitMs = Date.now() - waitStarted;
    holder.write('commit;');
    const released = Date.now();
    await waitForOutput(waiter, '"ok": true');
    const releaseMs = Date.now() - released;
    waiter.write('commit;');
    console.log(`second reservation was blocked on Lock/advisory after ${observedWaitMs} ms and finished ${releaseMs} ms after the holder committed`);
    assert.ok(observedWaitMs < 5000, `lock wait took ${observedWaitMs} ms`);
  } finally {
    for (const session of sessions) session.close();
    run('pg_ctl', ['-D', dir, '-m', 'immediate', 'stop']);
  }
});
