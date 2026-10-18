-- Close direct client access to public.transfers.
-- Run only after 20261018_transfer_claims.sql.
-- Do not execute until the Pages API that reads and writes these rows is deployed.
-- This does not delete or rewrite transfer rows, and it does not change R2 objects.
--
-- Supabase Free already provides anon, authenticated, and service_role.
-- The Pages function keeps using the service-role key, which bypasses row level security.
-- No Pro-only feature is required.
--
-- Rollback, only if the previous open policies must be restored:
--   grant select, insert, update, delete on table public.transfers to anon, authenticated;
--   and recreate the previous public_* policies.
-- Prefer leaving this migration in place and fixing the API instead.

alter table public.transfers enable row level security;
alter table public.transfers force row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'transfers'
  loop
    execute format('drop policy if exists %I on public.transfers', pol.policyname);
  end loop;
end $$;

-- Table privileges, not only policies. A grant would otherwise expose every column.
revoke all privileges on table public.transfers from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'revoke all privileges on table public.transfers from authenticator';
  end if;
end $$;

-- Keep sensitive columns closed even if a later change grants select on the table.
do $$
declare
  sensitive text[] := array['password_hash', 'file_path', 'user_id', 'multipart_upload_id'];
  present text[] := array[]::text[];
  col text;
begin
  foreach col in array sensitive loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'transfers'
        and column_name = col
    ) then
      present := array_append(present, col);
    end if;
  end loop;

  if coalesce(array_length(present, 1), 0) > 0 then
    execute format(
      'revoke select (%s) on table public.transfers from public, anon, authenticated',
      (
        select string_agg(quote_ident(item), ', ')
        from unnest(present) as item
      )
    );
  end if;
end $$;

-- No select, insert, update, or delete policy is created for anon or authenticated.
-- With row level security forced and no policy, those roles cannot see or change rows
-- even if a table grant is added later without a matching policy.
-- service_role is not revoked and bypasses row level security.

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'verify_transfer_password'
      and pg_get_function_identity_arguments(p.oid) in (
        'p_share_id text, p_password text',
        'text, text'
      )
  ) then
    execute 'revoke all on function public.verify_transfer_password(text, text) from public, anon, authenticated';
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute 'grant execute on function public.verify_transfer_password(text, text) to service_role';
    end if;
  end if;
end $$;

-- Realtime on this table delivered full rows to any subscriber who could select them.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'transfers'
     ) then
    alter publication supabase_realtime drop table public.transfers;
  end if;
end $$;
