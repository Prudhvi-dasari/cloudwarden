/**
 * Applies the tracked iTransfer migrations, then the reservation migration,
 * on a disposable cluster. It does not connect to hosted Supabase and it does
 * not run supabase db reset or db push.
 *
 * The production project has eight applied migrations. The reservation file
 * is not one of them. The oldest applied file alters AURO group tables that
 * this repository does not create, and public.transfers itself is not created
 * by any tracked migration. This test records that gap, then builds the
 * pre-iTransfer transfers table and applies the iTransfer files in order.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:net';

const MIGRATIONS = path.resolve('supabase/migrations');

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

function psqlFile(port, file) {
  return run('psql', [
    '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', file,
  ], { env: { ...process.env, PGHOST: '127.0.0.1' } });
}

function reserveSql(shareId, bytes, name) {
  return `select public.reserve_transfer_file(
    '${shareId}', '${name}', ${bytes}, 'transfers/hist/${name}',
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

async function waitForOutput(session, marker, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (session.output().includes(marker)) return;
    await delay(30);
  }
  throw new Error(`timed out waiting for ${marker}\n${session.output()}`);
}

test('reservation migration applies on the tracked iTransfer schema', async () => {
  const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();
  assert.deepEqual(files, [
    '20261011044722_group_likes_settlements_realtime.sql',
    '20261017113044_itransfer_r2_metadata_and_password_verify.sql',
    '20261017113315_fix_transfer_password_missing_row.sql',
    '20261017122134_create_file_requests.sql',
    '20261017135651_itransfer_accounts.sql',
    '20261018090000_transfer_claims.sql',
    '20261018100000_transfer_privileges.sql',
    '20261018110000_file_request_privileges.sql',
    '20261022193000_reserve_transfer_file.sql',
    '20261023004500_platform_storage_cap_and_download_slot.sql',
    '20261023093633_raise_platform_storage_cap.sql',
    '20261027131500_billing_entitlements.sql',
    '20261029120000_paid_transfer_allowance.sql',
  ]);

  const engine = readFileSync(path.resolve('functions/lib/r2Engine.js'), 'utf8');
  const getPut = engine.indexOf("action === 'get-put-url'");
  const initiate = engine.indexOf("action === 'initiate-upload'");
  const reserves = [...engine.matchAll(/await reserveTransferRow\(/g)].map((match) => match.index);
  assert.equal(reserves.length, 2);
  assert.ok(getPut > 0 && initiate > getPut);
  assert.ok(reserves[0] > getPut && reserves[0] < initiate);
  assert.ok(reserves[1] > initiate);

  const port = await reservePort();
  const dir = mkdtempSync(path.join(tmpdir(), 'itransfer-history-'));
  const logFile = path.join(dir, 'server.log');
  const sessions = [];
  try {
    const init = run('initdb', ['-D', dir, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--no-sync']);
    assert.equal(init.status, 0, init.stderr);
    const start = run('pg_ctl', ['-D', dir, '-l', logFile, '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1`, 'start']);
    assert.equal(start.status, 0, start.stderr);

    const auro = psqlFile(port, path.join(MIGRATIONS, files[0]));
    assert.notEqual(auro.status, 0);
    assert.match(`${auro.stderr}\n${auro.stdout}`, /group_posts/);

    const baseline = psql(port, `
      create extension if not exists pgcrypto;
      create schema if not exists auth;
      create table auth.users (id uuid primary key, email text);
      create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create role authenticator nologin;
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
        created_at timestamptz not null default now()
      );
    `);
    assert.equal(baseline.status, 0, baseline.stderr);

    for (const file of files.slice(1)) {
      const applied = psqlFile(port, path.join(MIGRATIONS, file));
      assert.equal(applied.status, 0, `${file}\n${applied.stderr}`);
    }

    const shape = psql(port, `
      select
        (select prosecdef from pg_proc where proname = 'reserve_transfer_file') as security_definer,
        (select proconfig::text from pg_proc where proname = 'reserve_transfer_file') as config,
        (select rolbypassrls from pg_roles where rolname = 'service_role') as service_bypass,
        (select indexdef from pg_indexes where indexname = 'transfers_share_occupied_idx') as indexdef,
        has_function_privilege('anon', 'public.reserve_transfer_file(text,text,bigint,text,text,text,text,text,text,text,text,text,text,integer,timestamptz,text)', 'execute') as anon_exec,
        has_function_privilege('authenticated', 'public.reserve_transfer_file(text,text,bigint,text,text,text,text,text,text,text,text,text,text,integer,timestamptz,text)', 'execute') as auth_exec,
        has_function_privilege('public', 'public.reserve_transfer_file(text,text,bigint,text,text,text,text,text,text,text,text,text,text,integer,timestamptz,text)', 'execute') as public_exec,
        has_function_privilege('service_role', 'public.reserve_transfer_file(text,text,bigint,text,text,text,text,text,text,text,text,text,text,integer,timestamptz,text)', 'execute') as service_exec;
    `);
    assert.equal(shape.status, 0, shape.stderr);
    assert.match(shape.stdout, /security_definer[\s\S]*f/);
    assert.match(shape.stdout, /search_path=public/);
    assert.match(shape.stdout, /service_bypass[\s\S]*t/);
    assert.match(shape.stdout, /WHERE \(COALESCE\(status, 'active'::text\) <> ALL \(ARRAY\['rejected'::text, 'expired'::text, 'released'::text\]\)\)/);
    assert.match(shape.stdout, /f\s+\|\s+f\s+\|\s+f\s+\|\s+t/);

    const platformGrant = psql(port, `grant all privileges on table public.transfers to service_role;`);
    assert.equal(platformGrant.status, 0, platformGrant.stderr);

    const denied = psql(port, `begin; set local role anon; ${reserveSql('histdeny', 1, 'nope.bin')}; commit;`);
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /permission denied/i);

    const seeded = psql(port, `
      insert into public.transfers (
        share_id, file_name, file_size, file_path, transfer_type, expires_at, status
      ) values
        ('histcap', 'active.bin', 12, 'transfers/hist/active.bin', 'link', now() + interval '1 day', 'active'),
        ('histcap', 'rejected.bin', 6000000000, 'transfers/hist/rejected.bin', 'link', now() + interval '1 day', 'rejected'),
        ('histcap', 'expired.bin', 6000000000, 'transfers/hist/expired.bin', 'link', now() + interval '1 day', 'expired'),
        ('histcap', 'released.bin', 6000000000, 'transfers/hist/released.bin', 'link', now() + interval '1 day', 'released');
    `);
    assert.equal(seeded.status, 0, seeded.stderr);

    const asService = psql(port, `
      begin;
      set local role service_role;
      ${reserveSql('histcap', 5999999988, 'fits.bin')};
      commit;
    `);
    assert.equal(asService.status, 0, asService.stderr);
    assert.match(asService.stdout, /"ok": true/);

    const before = psql(port, `select count(*) from public.transfers where share_id = 'histcap';`);
    const tooBig = psql(port, `
      begin;
      set local role service_role;
      ${reserveSql('histcap', 1, 'over.bin')};
      commit;
    `);
    const after = psql(port, `select count(*) from public.transfers where share_id = 'histcap';`);
    assert.equal(tooBig.status, 0, tooBig.stderr);
    assert.match(tooBig.stdout, /TRANSFER_TOO_LARGE/);
    assert.equal(before.stdout.trim(), after.stdout.trim());

    const held = psql(port, `
      update public.transfers set status = 'pending_delete'
      where share_id = 'histcap' and file_name = 'fits.bin';
      select coalesce(sum(file_size), 0) from public.transfers
      where share_id = 'histcap'
        and coalesce(status, 'active') not in ('rejected', 'expired', 'released');
    `);
    assert.match(held.stdout, /5999999999|6000000000/);

    const first = openSession(port, 'history-a');
    const second = openSession(port, 'history-b');
    sessions.push(first, second);
    await waitForOutput(first, '=#');
    await waitForOutput(second, '=#');
    first.write(`begin; ${reserveSql('histlock', 1000, 'a.bin')};`);
    await waitForOutput(first, '"ok": true');
    second.write(`begin; ${reserveSql('histlock', 1000, 'b.bin')};`);
    await waitFor(port, `
      select wait_event_type || '/' || wait_event
      from pg_stat_activity
      where application_name = 'history-b' and state = 'active';
    `, /Lock\/advisory/);
    first.write('commit;');
    await waitForOutput(second, '"ok": true');
    second.write('commit;');
    await waitFor(port, `
      select coalesce(sum(file_size), 0)::text from public.transfers
      where share_id = 'histlock' and status = 'pending';
    `, /\b2000\b/);
    const occupied = psql(port, `
      select coalesce(sum(file_size), 0)::text from public.transfers
      where share_id = 'histlock' and status = 'pending';
    `);
    assert.match(occupied.stdout, /\b2000\b/);
  } finally {
    for (const session of sessions) session.close();
    run('pg_ctl', ['-D', dir, 'stop', '-m', 'immediate']);
    rmSync(dir, { recursive: true, force: true });
  }
});
