-- Post-migration verification for tranferfiles (giyeepztahdbsejsozog).
-- Verification is valid only after the original two migrations and
-- supabase/migrations/20261023093633_raise_platform_storage_cap.sql
-- have been applied, in this order:
--   supabase/migrations/20261022193000_reserve_transfer_file.sql
--   supabase/migrations/20261023004500_platform_storage_cap_and_download_slot.sql
--   supabase/migrations/20261023093633_raise_platform_storage_cap.sql
-- Until the new migration is applied, platform_cap_source is expected to FAIL
-- and the serving cap is still the previous one.
--
-- This file has not been executed against production.
-- Section A is read-only. Section B writes only inside one DO block and then
-- raises, which aborts that transaction. Do not remove the final raise.
-- The SQL editor role proves the function bodies. Section A is what proves
-- service_role, anon, and authenticated privileges.

-- Section A. Run this statement by itself.

with funcs as (
  select
    p.proname,
    p.oid,
    p.prosecdef,
    p.prosrc,
    p.proconfig,
    pg_get_function_identity_arguments(p.oid) as identity_args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('reserve_transfer_file', 'claim_download_slot', 'release_download_slot')
),
expected as (
  select *
  from (
    values
      (
        'reserve_transfer_file',
        'public.reserve_transfer_file(text,text,bigint,text,text,text,text,text,text,text,text,text,text,integer,timestamp with time zone,text)'
      ),
      ('claim_download_slot', 'public.claim_download_slot(uuid,text)'),
      ('release_download_slot', 'public.release_download_slot(uuid,text)')
  ) as v(proname, regsignature)
)
select check_id, result, detail
from (
  select
    'signature_' || expected.proname as check_id,
    case
      when to_regprocedure(expected.regsignature) is null then 'FAIL'
      else 'PASS'
    end as result,
    coalesce(
      (select identity_args from funcs where proname = expected.proname),
      'function absent'
    ) as detail
  from expected

  union all
  select
    'security_' || expected.proname,
    case
      when not exists (select 1 from funcs where proname = expected.proname) then 'FAIL'
      when (select prosecdef from funcs where proname = expected.proname) then 'FAIL'
      when not exists (
        select 1
        from funcs
        where proname = expected.proname
          and exists (
            select 1 from unnest(coalesce(proconfig, array[]::text[])) as cfg
            where cfg = 'search_path=public'
          )
      ) then 'FAIL'
      else 'PASS'
    end,
    coalesce(
      (
        select 'security_definer=' || prosecdef::text || ' config=' || coalesce(array_to_string(proconfig, ','), 'none')
        from funcs
        where proname = expected.proname
      ),
      'function absent'
    )
  from expected

  union all
  select
    'privilege_' || expected.proname,
    case
      when to_regprocedure(expected.regsignature) is null then 'FAIL'
      when not exists (select 1 from pg_roles where rolname = 'service_role') then 'FAIL'
      when has_function_privilege('service_role', to_regprocedure(expected.regsignature), 'EXECUTE')
        and not has_function_privilege('anon', to_regprocedure(expected.regsignature), 'EXECUTE')
        and not has_function_privilege('authenticated', to_regprocedure(expected.regsignature), 'EXECUTE')
        and not has_function_privilege('public', to_regprocedure(expected.regsignature), 'EXECUTE') then 'PASS'
      else 'FAIL'
    end,
    case
      when to_regprocedure(expected.regsignature) is null then 'function absent'
      else expected.proname
        || ' service_role=' || has_function_privilege('service_role', to_regprocedure(expected.regsignature), 'EXECUTE')::text
        || ' anon=' || has_function_privilege('anon', to_regprocedure(expected.regsignature), 'EXECUTE')::text
        || ' authenticated=' || has_function_privilege('authenticated', to_regprocedure(expected.regsignature), 'EXECUTE')::text
        || ' public=' || has_function_privilege('public', to_regprocedure(expected.regsignature), 'EXECUTE')::text
    end
  from expected

  union all
  select
    'platform_cap_source',
    case
      when not exists (select 1 from funcs where proname = 'reserve_transfer_file') then 'FAIL'
      when strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'platform_limit constant bigint := 300000000000;') > 0 then 'FAIL'
      when strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), '2000000000000') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'ACCOUNT_QUOTA') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'itransfer-platform-v1') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), '6000000000') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'STORAGE_CAP') > 0 then 'PASS'
      when strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'platform_limit constant bigint := 1000000000000') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'itransfer-platform-v1') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), '6000000000') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'STORAGE_CAP') > 0 then 'PASS'
      else 'FAIL'
    end,
    case
      when not exists (select 1 from funcs where proname = 'reserve_transfer_file') then 'reserve_transfer_file is absent. Until the 1 TB migration is applied, platform_cap_source is expected to FAIL and the serving cap is still the previous one.'
      when strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'platform_limit constant bigint := 300000000000;') > 0
        then 'Source still assigns platform_limit constant bigint := 300000000000. That is the old 300 GB cap.'
      when strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), '2000000000000') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'ACCOUNT_QUOTA') > 0
        then 'Source contains the 2 TB default and ACCOUNT_QUOTA.'
      when strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'platform_limit constant bigint := 1000000000000') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'itransfer-platform-v1') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), '6000000000') > 0
        and strpos((select prosrc from funcs where proname = 'reserve_transfer_file'), 'STORAGE_CAP') > 0
        then 'Source contains platform_limit constant bigint := 1000000000000, itransfer-platform-v1, 6000000000, and STORAGE_CAP.'
      else 'Source is missing platform_limit constant bigint := 1000000000000, itransfer-platform-v1, 6000000000, or STORAGE_CAP. Until the 1 TB migration is applied, platform_cap_source is expected to FAIL and the serving cap is still the previous one. After the account-quota migration, expect 2000000000000 and ACCOUNT_QUOTA instead.'
    end

  union all
  select
    'index_share_occupied',
    case
      when exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'transfers'
          and indexname = 'transfers_share_occupied_idx'
          and indexdef ilike '%share_id%'
          and indexdef ilike '%file_size%'
          and indexdef ilike '%rejected%'
          and indexdef ilike '%expired%'
          and indexdef ilike '%released%'
      ) then 'PASS'
      else 'FAIL'
    end,
    coalesce((
      select indexdef
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'transfers'
        and indexname = 'transfers_share_occupied_idx'
    ), 'transfers_share_occupied_idx is absent')

  union all
  select
    'concurrent_share_lock',
    'REVIEW',
    'Two overlapping sessions are not opened by this script. The source check above confirms the platform lock name. A single-session share sum is in section B.'
) checks
order by check_id;

-- Section B. Run only after section A has no FAIL.
-- The final raise is the success signal and it aborts the transaction.
-- After the error, run this by itself and expect 0:
--   select count(*) from public.transfers where file_path like 'transfers/preflight-%';
-- Do not delete transfer rows to clean this up. The raise is the cleanup.

do $$
declare
  guest jsonb;
  second jsonb;
  share_text text := 'preflight' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  guest_path text := 'transfers/preflight-' || gen_random_uuid()::text || '/note.txt';
  slot_share text := 'preflight' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  slot_path text := 'transfers/preflight-' || gen_random_uuid()::text || '/slot.txt';
  slot_id uuid;
  first_claim jsonb;
  second_claim jsonb;
  released jsonb;
  fake jsonb;
  large_one jsonb;
  reserve_sig text := 'public.reserve_transfer_file(text,text,bigint,text,text,text,text,text,text,text,text,text,text,integer,timestamp with time zone,text)';
begin
  if to_regprocedure(reserve_sig) is null
    or to_regprocedure('public.claim_download_slot(uuid,text)') is null
    or to_regprocedure('public.release_download_slot(uuid,text)') is null
  then
    raise exception 'VERIFY_BEHAVIOR_NOT_RUN: one or more reservation functions are absent. Apply both migrations before this section.';
  end if;

  if (
    select
      strpos(p.prosrc, 'platform_limit constant bigint := 300000000000;') > 0
      or (
        strpos(p.prosrc, 'platform_limit constant bigint := 1000000000000') = 0
        and (
          strpos(p.prosrc, '2000000000000') = 0
          or strpos(p.prosrc, 'ACCOUNT_QUOTA') = 0
        )
      )
    from pg_proc p
    where p.oid = to_regprocedure(reserve_sig)
  ) then
    raise exception 'VERIFY_BEHAVIOR_NOT_RUN: reserve_transfer_file is not the 1000000000000-byte cap or the later 2000000000000 account-quota function. Apply the storage migration before this section. Refusing to write probe rows.';
  end if;

  guest := public.reserve_transfer_file(
    share_text, 'note.txt', 1, guest_path, 'text/plain',
    null, null, null, null, null, null,
    null, 'link', 0, now() + interval '1 hour', 'r2'
  );
  if guest->>'ok' is distinct from 'true' or guest->>'status' is distinct from 'pending' then
    raise exception 'VERIFY_BEHAVIOR_FAIL guest reservation %', guest;
  end if;

  begin
    fake := public.reserve_transfer_file(
      share_text, 'note.txt', 1, guest_path || '-fake', 'text/plain',
      null, null, null, null, null, null,
      '00000000-0000-0000-0000-000000000000', 'link', 0, now() + interval '1 hour', 'r2'
    );
    if fake->>'ok' = 'true' then
      raise exception 'VERIFY_BEHAVIOR_FAIL fake user id was accepted %', fake;
    end if;
    raise exception 'VERIFY_BEHAVIOR_FAIL fake user id was not rejected by the foreign key %', fake;
  exception
    when foreign_key_violation then
      null;
  end;

  large_one := public.reserve_transfer_file(
    share_text, 'large.bin', 3000000001, 'transfers/preflight-' || gen_random_uuid()::text || '/large.bin', 'application/octet-stream',
    null, null, null, null, null, null,
    null, 'link', 0, now() + interval '1 hour', 'r2'
  );
  if large_one->>'ok' is distinct from 'true' then
    raise exception 'VERIFY_BEHAVIOR_FAIL first half of the share cap returned %', large_one;
  end if;

  second := public.reserve_transfer_file(
    share_text, 'large-2.bin', 3000000001, 'transfers/preflight-' || gen_random_uuid()::text || '/large-2.bin', 'application/octet-stream',
    null, null, null, null, null, null,
    null, 'link', 0, now() + interval '1 hour', 'r2'
  );
  if second->>'code' is distinct from 'TRANSFER_TOO_LARGE' then
    raise exception 'VERIFY_BEHAVIOR_FAIL second half of the share cap returned %', second;
  end if;

  insert into public.transfers (
    share_id, file_name, file_size, file_path, transfer_type,
    max_downloads, download_count, expires_at, status, storage_provider
  ) values (
    slot_share, 'slot.txt', 1, slot_path, 'link',
    1, 0, now() + interval '1 hour', 'active', 'r2'
  )
  returning id into slot_id;

  first_claim := public.claim_download_slot(slot_id, slot_share);
  second_claim := public.claim_download_slot(slot_id, slot_share);
  if first_claim->>'ok' is distinct from 'true' or first_claim->>'download_count' is distinct from '1' then
    raise exception 'VERIFY_BEHAVIOR_FAIL first claim %', first_claim;
  end if;
  if second_claim->>'code' is distinct from 'DOWNLOAD_LIMIT' then
    raise exception 'VERIFY_BEHAVIOR_FAIL second claim %', second_claim;
  end if;

  released := public.release_download_slot(slot_id, slot_share);
  if released->>'ok' is distinct from 'true' or released->>'download_count' is distinct from '0' then
    raise exception 'VERIFY_BEHAVIOR_FAIL release %', released;
  end if;

  if (select count(*) from public.transfers where file_path = guest_path) <> 1 then
    raise exception 'VERIFY_BEHAVIOR_FAIL guest row was not visible before rollback';
  end if;

  raise exception 'VERIFY_BEHAVIOR_PASS guest reservation, fake user rejection, share sum, claim refusal, and release-to-zero were checked. This error aborts the transaction on purpose.';
end $$;
