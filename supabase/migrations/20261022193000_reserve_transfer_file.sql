-- Atomic per-share reservation for the 6 GB free transfer limit.
-- Additive. Does not update, delete, or rewrite existing transfer rows.
-- Does not change grants on public.transfers.
-- Apply this file, then
-- 20261023004500_platform_storage_cap_and_download_slot.sql, and only then
-- deploy the Worker that calls reserve_transfer_file. Do not deploy that
-- Worker before both files are applied. Do not run this file from the
-- repository root against the remote project as part of a local test.
--
-- The Worker still rejects a single file above 6,000,000,000 bytes before
-- calling this function. The function repeats that check so a direct call
-- cannot insert an oversized row.
--
-- Rollback only after the serving Pages deployment does not call this
-- function. If the new deployment is already serving, roll Pages back first.
-- Then, while no upload is using the function:
--   drop function if exists public.reserve_transfer_file(
--     text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text
--   );

create index if not exists transfers_share_occupied_idx
  on public.transfers (share_id, file_size)
  where coalesce(status, 'active') not in ('rejected', 'expired', 'released');

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
  new_id uuid;
  limit_bytes constant bigint := 6000000000;
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

  if p_file_size is null or p_file_size <= 0 or p_file_size > limit_bytes then
    return jsonb_build_object('ok', false, 'code', 'TRANSFER_TOO_LARGE');
  end if;

  -- Same share always maps to the same key. A hash collision only makes two
  -- different shares wait on each other.
  perform pg_advisory_xact_lock(hashtext('itransfer-share-v1'), hashtext(p_share_id));

  select coalesce(sum(file_size), 0)
    into occupied
  from public.transfers
  where share_id = p_share_id
    and coalesce(status, 'active') not in ('rejected', 'expired', 'released');

  if occupied + p_file_size > limit_bytes then
    return jsonb_build_object('ok', false, 'code', 'TRANSFER_TOO_LARGE');
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
