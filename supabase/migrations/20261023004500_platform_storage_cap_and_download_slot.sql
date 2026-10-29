-- Platform storage cap and atomic per-file download slots.
-- Additive. Replaces reserve_transfer_file with the same arguments.
-- Does not change grants on public.transfers and does not rewrite existing rows.
-- Not applied to production. Apply it before deploying the Worker that calls
-- claim_download_slot. The replaced reservation function keeps the 6 GB share
-- cap and adds a 300 GB platform cap. An older Worker treats STORAGE_CAP as
-- RECORD_FAILED, which still refuses the insert.
--
-- Rollback only after the serving Pages deployment does not call these
-- functions. If that deployment is already serving, roll Pages back first.
-- Then, while no upload is using the functions:
--   drop function if exists public.claim_download_slot(uuid, text);
--   drop function if exists public.release_download_slot(uuid, text);
--   then restore the previous reserve_transfer_file body from
--   20261022193000_reserve_transfer_file.sql.

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
  share_limit constant bigint := 6000000000;
  platform_limit constant bigint := 300000000000;
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

  if p_file_size is null or p_file_size <= 0 or p_file_size > share_limit then
    return jsonb_build_object('ok', false, 'code', 'TRANSFER_TOO_LARGE');
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

create or replace function public.claim_download_slot(
  p_file_id uuid,
  p_share_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target public.transfers%rowtype;
  next_count integer;
begin
  select *
    into target
  from public.transfers
  where id = p_file_id
    and share_id = p_share_id
  for update;

  if not found
    or target.file_path is null
    or target.file_path not like 'transfers/%'
    or target.file_path like '%..%'
  then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if target.expires_at <= now()
    or coalesce(target.status, 'active') in ('expired', 'pending_delete')
  then
    return jsonb_build_object('ok', false, 'code', 'EXPIRED');
  end if;

  if coalesce(target.status, 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'NOT_READY');
  end if;

  if coalesce(target.max_downloads, 0) > 0
    and coalesce(target.download_count, 0) >= target.max_downloads
  then
    return jsonb_build_object('ok', false, 'code', 'DOWNLOAD_LIMIT');
  end if;

  update public.transfers
    set download_count = coalesce(download_count, 0) + 1
  where id = target.id
  returning download_count into next_count;

  return jsonb_build_object(
    'ok', true,
    'download_count', next_count,
    'file_path', target.file_path,
    'file_name', target.file_name
  );
end;
$$;

create or replace function public.release_download_slot(
  p_file_id uuid,
  p_share_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.transfers
    set download_count = download_count - 1
  where id = p_file_id
    and share_id = p_share_id
    and download_count > 0
  returning download_count into next_count;

  return jsonb_build_object('ok', true, 'download_count', coalesce(next_count, 0));
end;
$$;

revoke all on function public.claim_download_slot(uuid, text) from public;
revoke all on function public.release_download_slot(uuid, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.claim_download_slot(uuid, text) from anon';
    execute 'revoke all on function public.release_download_slot(uuid, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.claim_download_slot(uuid, text) from authenticated';
    execute 'revoke all on function public.release_download_slot(uuid, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.claim_download_slot(uuid, text) to service_role';
    execute 'grant execute on function public.release_download_slot(uuid, text) to service_role';
  end if;
end $$;
