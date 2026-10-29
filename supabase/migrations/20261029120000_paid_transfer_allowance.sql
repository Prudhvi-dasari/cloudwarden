-- Replaces public.reserve_transfer_file with the same arguments.
-- A guest or a user without an active billing entitlement stays at 6000000000 bytes
-- and 168 hours. An active entitlement raises that one transfer to 250000000000
-- bytes and 4320 hours (180 days). The platform cap stays 1000000000000.
-- This file has not been applied to production.
-- Rollback is CREATE OR REPLACE back to 20261023093633_raise_platform_storage_cap.sql.
-- Do not drop public.reserve_transfer_file.

create or replace function public.reserve_transfer_file(
  p_share_id text,
  p_file_name text,
  p_file_size bigint,
  p_file_path text,
  p_content_type text,
  p_subject text,
  p_message text,
  p_sender_email text,
  p_recipient_emails text,
  p_request_id text,
  p_password_hash text,
  p_user_id text,
  p_transfer_type text,
  p_max_downloads integer,
  p_expires_at timestamptz,
  p_storage_provider text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  occupied bigint;
  platform bigint;
  new_id uuid;
  paid boolean := false;
  share_limit bigint;
  max_hours integer;
  free_limit constant bigint := 6000000000;
  paid_limit constant bigint := 250000000000;
  platform_limit constant bigint := 1000000000000;
begin
  if p_share_id is null
    or char_length(p_share_id) < 4
    or char_length(p_share_id) > 80
    or p_file_name is null
    or p_file_path is null
    or p_file_path not like 'transfers/%'
    or p_file_path like '%..%'
    or p_expires_at is null
  then
    return jsonb_build_object('ok', false, 'code', 'RECORD_FAILED');
  end if;

  if nullif(btrim(p_user_id), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select exists (
      select 1
      from public.billing_entitlements
      where user_id = nullif(btrim(p_user_id), '')::uuid
        and status = 'active'
    ) into paid;
  end if;

  share_limit := case when paid then paid_limit else free_limit end;
  max_hours := case when paid then 4320 else 168 end;

  if p_file_size is null or p_file_size <= 0 or p_file_size > share_limit then
    return jsonb_build_object('ok', false, 'code', 'TRANSFER_TOO_LARGE');
  end if;

  if p_expires_at > now() + make_interval(hours => max_hours + 1) then
    return jsonb_build_object('ok', false, 'code', 'EXPIRY_TOO_LONG');
  end if;

  -- Platform first, then the share. Every caller uses this order.
  perform pg_advisory_xact_lock(hashtext('itransfer-platform-v1'), 0);
  perform pg_advisory_xact_lock(hashtext('itransfer-share-v1'), hashtext(p_share_id));

  select coalesce(sum(file_size), 0)
    into occupied
  from public.transfers
  where share_id = p_share_id
    and coalesce(status, 'active') not in ('rejected', 'expired', 'released');

  if occupied + p_file_size > share_limit then
    return jsonb_build_object('ok', false, 'code', 'TRANSFER_TOO_LARGE');
  end if;

  select coalesce(sum(file_size), 0)
    into platform
  from public.transfers
  where coalesce(status, 'active') not in ('rejected', 'expired', 'released');

  if platform + p_file_size > platform_limit then
    return jsonb_build_object('ok', false, 'code', 'STORAGE_CAP');
  end if;

  insert into public.transfers (
    share_id,
    file_name,
    file_size,
    file_path,
    content_type,
    subject,
    message,
    sender_email,
    recipient_emails,
    request_id,
    password_hash,
    user_id,
    transfer_type,
    max_downloads,
    expires_at,
    storage_provider,
    status
  ) values (
    p_share_id,
    p_file_name,
    p_file_size,
    p_file_path,
    p_content_type,
    p_subject,
    p_message,
    p_sender_email,
    p_recipient_emails,
    p_request_id,
    p_password_hash,
    nullif(btrim(p_user_id), '')::uuid,
    coalesce(nullif(btrim(p_transfer_type), ''), 'link'),
    case when p_max_downloads is null or p_max_downloads < 0 then 0 else p_max_downloads end,
    p_expires_at,
    coalesce(nullif(btrim(p_storage_provider), ''), 'r2'),
    'pending'
  )
  returning id into new_id;

  return jsonb_build_object(
    'ok', true,
    'id', new_id,
    'file_path', p_file_path,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.reserve_transfer_file(
  text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) to service_role';
  end if;
end $$;
