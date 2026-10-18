/**
 * Real PostgreSQL privilege test.
 *
 * This is not a mock and it does not connect to hosted Supabase.
 * It creates a temporary local cluster, reproduces the open transfer
 * grants, applies the claims migration and then the privileges migration,
 * and checks anon and authenticated can no longer write or read secrets.
 * The service role can still read the existing row.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:net';

const CLAIMS = path.resolve('supabase/migrations/20261018090000_transfer_claims.sql');
const PRIVILEGES = path.resolve('../itransfer-migrations-hold-20261018/20261019_transfer_privileges.sql');

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

function expectDenied(port, sql) {
  const result = psql(port, sql);
  assert.notEqual(result.status, 0, result.stdout || result.stderr);
  assert.match(`${result.stderr}\n${result.stdout}`, /permission denied/i);
}

test('real PostgreSQL: anon and authenticated cannot write transfers or read secrets after the migration', async () => {
  const port = await reservePort();
  const dir = mkdtempSync(path.join(tmpdir(), 'itransfer-pg-'));
  const logFile = path.join(dir, 'server.log');
  try {
    const init = run('initdb', ['-D', dir, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--no-sync']);
    assert.equal(init.status, 0, init.stderr);
    const start = run('pg_ctl', ['-D', dir, '-l', logFile, '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1`, 'start']);
    assert.equal(start.status, 0, start.stderr);

    const fixture = psql(port, `
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
        password_hash text,
        user_id text,
        transfer_type text,
        download_count integer default 0,
        max_downloads integer default 0,
        created_at timestamptz default now(),
        expires_at timestamptz not null,
        status text,
        storage_provider text,
        multipart_upload_id text
      );
      grant all privileges on table public.transfers to anon, authenticated, service_role;
      alter table public.transfers enable row level security;
      create policy public_insert_transfers on public.transfers for insert to anon, authenticated with check (true);
      create policy public_select_transfers on public.transfers for select to anon, authenticated using (true);
      create policy public_update_transfers on public.transfers for update to anon, authenticated using (true) with check (true);
      create policy public_delete_transfers on public.transfers for delete to anon, authenticated using (true);
      insert into public.transfers (share_id, file_name, file_size, file_path, password_hash, expires_at, status)
      values ('legacy-link', 'notes.txt', 4, 'transfers/legacy/file.txt', 'stored-hash', now() + interval '1 day', 'active');
      create function public.verify_transfer_password(p_share_id text, p_password text)
      returns boolean language sql security definer set search_path = public as $$ select true $$;
      grant execute on function public.verify_transfer_password(text, text) to public, anon, authenticated;
    `);
    assert.equal(fixture.status, 0, fixture.stderr);

    const openInsert = psql(port, `
      begin;
      set local role anon;
      insert into public.transfers (share_id, file_name, file_size, file_path, expires_at, status)
      values ('anon-made', 'x.txt', 1, 'transfers/anon/x.txt', now() + interval '1 day', 'active');
      commit;
    `);
    assert.equal(openInsert.status, 0, openInsert.stderr);

    for (const file of [CLAIMS, PRIVILEGES]) {
      const applied = run('psql', [
        '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', file,
      ]);
      assert.equal(applied.status, 0, `${file}\n${applied.stderr}`);
    }

    const claimInsert = psql(port, `
      begin;
      set local role service_role;
      insert into public.transfer_claims (share_id, purpose, token_hash, expires_at)
      values ('legacy-link', 'delete', repeat('ab', 32), now() + interval '1 day');
      commit;
    `);
    assert.equal(claimInsert.status, 0, claimInsert.stderr);
    expectDenied(port, `
      begin;
      set local role anon;
      select token_hash from public.transfer_claims;
      commit;
    `);

    expectDenied(port, `
      begin;
      set local role anon;
      insert into public.transfers (share_id, file_name, file_size, file_path, expires_at)
      values ('blocked', 'x.txt', 1, 'transfers/blocked/x.txt', now() + interval '1 day');
      commit;
    `);
    expectDenied(port, `
      begin;
      set local role anon;
      update public.transfers set user_id = 'intruder', expires_at = now(), status = 'active' where share_id = 'legacy-link';
      commit;
    `);
    expectDenied(port, `
      begin;
      set local role anon;
      delete from public.transfers where share_id = 'legacy-link';
      commit;
    `);
    expectDenied(port, `
      begin;
      set local role anon;
      select password_hash, file_path from public.transfers;
      commit;
    `);
    expectDenied(port, `
      begin;
      set local role authenticated;
      update public.transfers set user_id = 'someone-else' where share_id = 'legacy-link';
      commit;
    `);
    expectDenied(port, `
      begin;
      set local role authenticated;
      select * from public.transfers;
      commit;
    `);
    expectDenied(port, `
      begin;
      set local role anon;
      select public.verify_transfer_password('legacy-link', 'stored-hash');
      commit;
    `);

    const preserved = psql(port, `
      begin;
      set local role service_role;
      select share_id, file_name, password_hash, file_path, status from public.transfers where share_id = 'legacy-link';
      commit;
    `);
    assert.equal(preserved.status, 0, preserved.stderr);
    assert.match(preserved.stdout, /legacy-link/);
    assert.match(preserved.stdout, /notes.txt/);
    assert.match(preserved.stdout, /stored-hash/);
    assert.match(preserved.stdout, /transfers\/legacy\/file.txt/);

    const stillThere = psql(port, `select count(*) from public.transfers where share_id in ('legacy-link', 'anon-made');`);
    assert.equal(stillThere.status, 0, stillThere.stderr);
    assert.match(stillThere.stdout, /\b2\b/);
  } finally {
    run('pg_ctl', ['-D', dir, '-m', 'immediate', 'stop']);
    rmSync(dir, { recursive: true, force: true });
  }
});
