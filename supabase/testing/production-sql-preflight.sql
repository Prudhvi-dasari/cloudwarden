-- Read-only preflight for the two unapplied production migrations.
-- Run this whole statement in the Supabase SQL Editor for tranferfiles
-- (giyeepztahdbsejsozog) before either file is applied.
--
-- It does not insert, update, delete, create, drop, or grant.
-- It has not been executed against production. A PASS here is a catalog
-- comparison, not proof that the migrations are safe, until a person runs it
-- on the live database and reads every row.
--
-- PASS   = matches the expected pre-migration state, including an expected absence.
-- FAIL   = blocker. Do not apply either migration.
-- REVIEW = a person must read the detail before apply. It is not by itself a blocker.
--
-- Expected before apply: reserve_transfer_file, claim_download_slot, and
-- release_download_slot are absent, and transfers_share_occupied_idx is absent.
-- The 23 October 2026 catalog read is the comparison shape. This script checks
-- the database it is connected to.

with cols as (
  select column_name, udt_name, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'transfers'
),
spec as (
  select *
  from (
    values
      ('id', 'uuid', 'default_or_nullable', 'required'),
      ('share_id', 'text', 'any', 'required'),
      ('file_name', 'text', 'any', 'required'),
      ('file_size', 'int8', 'any', 'required'),
      ('file_path', 'text', 'any', 'required'),
      ('content_type', 'text', 'any', 'required'),
      ('subject', 'text', 'any', 'required'),
      ('message', 'text', 'any', 'required'),
      ('sender_email', 'text', 'any', 'required'),
      ('recipient_emails', 'text', 'nullable', 'required'),
      ('password_hash', 'text', 'any', 'required'),
      ('user_id', 'uuid', 'nullable', 'required'),
      ('transfer_type', 'text', 'any', 'required'),
      ('max_downloads', 'int4', 'any', 'required'),
      ('expires_at', 'timestamptz', 'any', 'required'),
      ('status', 'text', 'any', 'required'),
      ('storage_provider', 'text', 'any', 'required'),
      ('download_count', 'int4', 'default_or_nullable', 'required'),
      ('created_at', 'timestamptz', 'default_or_nullable', 'required'),
      ('request_id', 'text', 'any', 'required'),
      ('download_logs', 'jsonb', 'default_or_nullable', 'optional'),
      ('multipart_upload_id', 'text', 'any', 'optional')
  ) as v(column_name, udt_name, null_rule, presence)
),
column_checks as (
  select
    'column_' || spec.column_name as check_id,
    case
      when to_regclass('public.transfers') is null then 'FAIL'
      when cols.column_name is null and spec.presence = 'required' then 'FAIL'
      when cols.column_name is null then 'REVIEW'
      when cols.udt_name is distinct from spec.udt_name then 'FAIL'
      when spec.null_rule = 'nullable' and cols.is_nullable <> 'YES' then 'FAIL'
      when spec.null_rule = 'default_or_nullable'
        and cols.is_nullable <> 'YES'
        and cols.column_default is null then 'FAIL'
      else 'PASS'
    end as result,
    case
      when to_regclass('public.transfers') is null then 'public.transfers is absent'
      when cols.column_name is null and spec.presence = 'optional' then spec.column_name || ' is absent. The reservation insert does not write it.'
      when cols.column_name is null then spec.column_name || ' is absent'
      else spec.column_name || ' udt=' || cols.udt_name
        || ' nullable=' || cols.is_nullable
        || ' default=' || coalesce(cols.column_default, 'none')
    end as detail
  from spec
  left join cols using (column_name)
),
status_checks as (
  select coalesce(string_agg(pg_get_constraintdef(con.oid), ' | ' order by con.conname), '') as defs
  from pg_constraint con
  where con.conrelid = to_regclass('public.transfers')
    and con.contype = 'c'
),
fk_checks as (
  select coalesce(string_agg(pg_get_constraintdef(con.oid), ' | ' order by con.conname), '') as defs
  from pg_constraint con
  where con.conrelid = to_regclass('public.transfers')
    and con.contype = 'f'
),
relation as (
  select c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'transfers'
),
applied as (
  select version
  from supabase_migrations.schema_migrations
  where to_regclass('supabase_migrations.schema_migrations') is not null
),
funcs as (
  select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('reserve_transfer_file', 'claim_download_slot', 'release_download_slot')
)
select check_id, result, detail
from (
  select
    'migration_history' as check_id,
    case
      when to_regclass('supabase_migrations.schema_migrations') is null then 'FAIL'
      when not exists (select 1 from applied where version = '20261018110000') then 'FAIL'
      when exists (select 1 from applied where version in ('20261022193000', '20261023004500')) then 'REVIEW'
      else 'PASS'
    end as result,
    case
      when to_regclass('supabase_migrations.schema_migrations') is null then 'supabase_migrations.schema_migrations is absent'
      else 'latest=' || coalesce((select max(version) from applied), 'none')
        || case
          when exists (select 1 from applied where version in ('20261022193000', '20261023004500'))
            then '. One or both reservation versions are already recorded. Do not apply them again until the verify script is read.'
          else '. Expected: history includes 20261018110000 and does not include the two reservation versions.'
        end
    end as detail

  union all
  select
    'table_transfers',
    case when to_regclass('public.transfers') is null then 'FAIL' else 'PASS' end,
    case when to_regclass('public.transfers') is null then 'public.transfers is absent' else 'public.transfers exists' end

  union all
  select check_id, result, detail from column_checks

  union all
  select
    'status_check',
    case
      when to_regclass('public.transfers') is null then 'FAIL'
      when (select defs from status_checks) = '' then 'PASS'
      when (select defs from status_checks) ilike '%status%'
        and (select defs from status_checks) not ilike '%pending%' then 'FAIL'
      else 'REVIEW'
    end,
    case
      when (select defs from status_checks) = '' then 'No check constraint. pending is not rejected. This is the expected pre-migration state.'
      else 'Check constraints: ' || (select defs from status_checks)
    end

  union all
  select
    'user_id_fk',
    case
      when to_regclass('public.transfers') is null then 'FAIL'
      when (select defs from fk_checks) ilike '%user_id%'
        and (select defs from fk_checks) ilike '%auth.users%'
        and (select defs from fk_checks) ilike '%ON DELETE SET NULL%' then 'PASS'
      when (select defs from fk_checks) = '' then 'REVIEW'
      else 'REVIEW'
    end,
    case
      when (select defs from fk_checks) = '' then 'No foreign key. Guest user_id null still inserts. A signed-in id is not checked against auth.users.'
      else (select defs from fk_checks)
    end

  union all
  select
    'rls',
    case
      when to_regclass('public.transfers') is null then 'FAIL'
      when coalesce((select relrowsecurity and relforcerowsecurity from relation), false) then 'PASS'
      when coalesce((select relrowsecurity from relation), false) then 'REVIEW'
      else 'FAIL'
    end,
    'enabled=' || coalesce((select relrowsecurity::text from relation), 'absent')
      || ' forced=' || coalesce((select relforcerowsecurity::text from relation), 'absent')

  union all
  select
    'role_bypass',
    case
      when not exists (select 1 from pg_roles where rolname = 'service_role') then 'FAIL'
      when exists (select 1 from pg_roles where rolname = 'service_role' and rolbypassrls)
        and not exists (select 1 from pg_roles where rolname = 'anon' and rolbypassrls)
        and not exists (select 1 from pg_roles where rolname = 'authenticated' and rolbypassrls) then 'PASS'
      when exists (select 1 from pg_roles where rolname in ('anon', 'authenticated') and rolbypassrls) then 'FAIL'
      else 'REVIEW'
    end,
    coalesce((
      select string_agg(rolname || '=' || rolbypassrls::text, ', ' order by rolname)
      from pg_roles
      where rolname in ('anon', 'authenticated', 'service_role')
    ), 'roles absent')

  union all
  select
    'service_role_insert',
    case
      when to_regclass('public.transfers') is null then 'FAIL'
      when not exists (select 1 from pg_roles where rolname = 'service_role') then 'FAIL'
      when has_table_privilege('service_role', 'public.transfers', 'INSERT')
        and has_table_privilege('service_role', 'public.transfers', 'UPDATE')
        and has_table_privilege('service_role', 'public.transfers', 'SELECT') then 'PASS'
      else 'FAIL'
    end,
    'service_role needs SELECT, INSERT, and UPDATE on public.transfers because the functions are security invoker'

  union all
  select
    'index_primary_key',
    case
      when exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'transfers' and indexname = 'transfers_pkey'
      ) then 'PASS'
      else 'FAIL'
    end,
    coalesce((
      select indexdef from pg_indexes
      where schemaname = 'public' and tablename = 'transfers' and indexname = 'transfers_pkey'
    ), 'transfers_pkey is absent')

  union all
  select
    'index_share_occupied',
    'PASS',
    case
      when exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'transfers' and indexname = 'transfers_share_occupied_idx'
      ) then 'transfers_share_occupied_idx already exists. The first migration uses create index if not exists.'
      else 'transfers_share_occupied_idx is absent. That is expected before the first migration.'
    end

  union all
  select
    'index_catalog',
    case
      when to_regclass('public.transfers') is null then 'FAIL'
      when exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'transfers' and indexname = 'transfers_expires_at_idx'
      ) and exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'transfers' and indexname = 'transfers_request_id_idx'
      ) and exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'transfers' and indexname = 'transfers_share_id_idx'
      ) then 'PASS'
      else 'REVIEW'
    end,
    coalesce((
      select string_agg(indexname, ', ' order by indexname)
      from pg_indexes
      where schemaname = 'public' and tablename = 'transfers'
    ), 'no indexes')

  union all
  select
    'function_reserve_transfer_file',
    case
      when not exists (select 1 from funcs where proname = 'reserve_transfer_file') then 'PASS'
      when to_regprocedure('public.reserve_transfer_file(text,text,bigint,text,text,text,text,text,text,text,text,text,text,integer,timestamp with time zone,text)') is not null then 'REVIEW'
      else 'FAIL'
    end,
    case
      when not exists (select 1 from funcs where proname = 'reserve_transfer_file') then 'Absent. Expected before either migration.'
      else 'Present: ' || (select string_agg(args, ' || ') from funcs where proname = 'reserve_transfer_file')
    end

  union all
  select
    'function_claim_download_slot',
    case
      when not exists (select 1 from funcs where proname = 'claim_download_slot') then 'PASS'
      when to_regprocedure('public.claim_download_slot(uuid,text)') is not null then 'REVIEW'
      else 'FAIL'
    end,
    case
      when not exists (select 1 from funcs where proname = 'claim_download_slot') then 'Absent. Expected before the second migration.'
      else 'Present: ' || (select string_agg(args, ' || ') from funcs where proname = 'claim_download_slot')
    end

  union all
  select
    'function_release_download_slot',
    case
      when not exists (select 1 from funcs where proname = 'release_download_slot') then 'PASS'
      when to_regprocedure('public.release_download_slot(uuid,text)') is not null then 'REVIEW'
      else 'FAIL'
    end,
    case
      when not exists (select 1 from funcs where proname = 'release_download_slot') then 'Absent. Expected before the second migration.'
      else 'Present: ' || (select string_agg(args, ' || ') from funcs where proname = 'release_download_slot')
    end
) checks
order by check_id;
