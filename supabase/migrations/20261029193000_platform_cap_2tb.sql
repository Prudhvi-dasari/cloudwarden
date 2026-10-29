-- Raises the whole-platform cap to 2 TB (2000000000000 bytes) and lets
-- STORAGE_GLOBAL_CAP_BYTES override it through set_platform_storage_cap.
-- Free and guest reservations stop at 90% so a paying account can still send
-- until the hard cap. Pending and active rows already count as occupied.
-- Apply after review. This file has not been applied to production.
-- Rollback is CREATE OR REPLACE back to 20261029120000_paid_transfer_allowance.sql.

create table if not exists public.platform_storage_settings (
  id integer primary key check (id = 1),
  cap_bytes bigint not null default 2000000000000,
  soft_ratio numeric not null default 0.9,
  updated_at timestamptz not null default now()
);

insert into public.platform_storage_settings (id, cap_bytes, soft_ratio)
values (1, 2000000000000, 0.9)
on conflict (id) do nothing;

alter table public.platform_storage_settings enable row level security;
revoke all on public.platform_storage_settings from public, anon, authenticated;

create table if not exists public.upload_daily_usage (
  subject text primary key,
  bytes bigint not null default 0,
  window_start timestamptz not null default now()
);

alter table public.upload_daily_usage enable row level security;
revoke all on public.upload_daily_usage from public, anon, authenticated;

create or replace function public.set_platform_storage_cap(p_cap bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cap is null or p_cap < 6000000000 then
    raise exception 'STORAGE_CAP_INVALID';
  end if;
  insert into public.platform_storage_settings (id, cap_bytes, soft_ratio)
  values (1, p_cap, 0.9)
  on conflict (id) do update
    set cap_bytes = excluded.cap_bytes,
        updated_at = now();
end;
$$;

create or replace function public.consume_daily_upload(
  p_subject text,
  p_bytes bigint,
  p_limit bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_bytes bigint := 0;
  started timestamptz;
begin
  if p_subject is null or length(p_subject) < 4 or length(p_subject) > 80
    or p_bytes is null or p_bytes <= 0
    or p_limit is null or p_limit <= 0
  then
    return jsonb_build_object('ok', false, 'code', 'DAILY_LIMIT');
  end if;

  perform pg_advisory_xact_lock(hashtext('itransfer-daily'), hashtext(p_subject));

  select bytes, window_start into current_bytes, started
  from public.upload_daily_usage
  where subject = p_subject
  for update;

  if not found or started < now() - interval '24 hours' then
    current_bytes := 0;
    insert into public.upload_daily_usage (subject, bytes, window_start)
    values (p_subject, 0, now())
    on conflict (subject) do update
      set bytes = 0,
          window_start = now();
  end if;

  if current_bytes + p_bytes > p_limit then
    return jsonb_build_object('ok', false, 'code', 'DAILY_LIMIT', 'used', current_bytes);
  end if;

  update public.upload_daily_usage
    set bytes = current_bytes + p_bytes
    where subject = p_subject;

  return jsonb_build_object('ok', true, 'used', current_bytes + p_bytes);
end;
$$;

create or replace function public.release_daily_upload(p_subject text, p_bytes bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_subject is null or p_bytes is null or p_bytes <= 0 then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('itransfer-daily'), hashtext(p_subject));
  update public.upload_daily_usage
    set bytes = greatest(0, bytes - p_bytes)
    where subject = p_subject
      and window_start >= now() - interval '24 hours';
end;
$$;

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
  platform_limit bigint := 2000000000000;
  soft_ratio numeric := 0.9;
  free_limit constant bigint := 6000000000;
  paid_limit constant bigint := 250000000000;
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

  select s.cap_bytes, s.soft_ratio
    into platform_limit, soft_ratio
  from public.platform_storage_settings s
  where s.id = 1;
  if platform_limit is null or platform_limit <= 0 then
    platform_limit := 2000000000000;
  end if;
  if soft_ratio is null or soft_ratio <= 0 or soft_ratio > 1 then
    soft_ratio := 0.9;
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

  if not paid and platform + p_file_size > floor(platform_limit * soft_ratio) then
    return jsonb_build_object('ok', false, 'code', 'STORAGE_BUSY');
  end if;

  if platform + p_file_size > platform_limit then
    return jsonb_build_object('ok', false, 'code', 'STORAGE_CAP');
  end if;

  insert into public.transfers (
    share_id, file_name, file_size, file_path, content_type, subject, message,
    sender_email, recipient_emails, request_id, password_hash, user_id,
    transfer_type, max_downloads, expires_at, storage_provider, status
  ) values (
    p_share_id, p_file_name, p_file_size, p_file_path, p_content_type, p_subject, p_message,
    p_sender_email, p_recipient_emails, p_request_id, p_password_hash,
    nullif(btrim(p_user_id), '')::uuid,
    coalesce(nullif(btrim(p_transfer_type), ''), 'link'),
    case when p_max_downloads is null or p_max_downloads < 0 then 0 else p_max_downloads end,
    p_expires_at,
    coalesce(nullif(btrim(p_storage_provider), ''), 'r2'),
    'pending'
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id, 'file_path', p_file_path, 'status', 'pending');
end;
$$;

revoke all on function public.set_platform_storage_cap(bigint) from public;
revoke all on function public.consume_daily_upload(text, bigint, bigint) from public;
revoke all on function public.release_daily_upload(text, bigint) from public;
revoke all on function public.reserve_transfer_file(
  text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.set_platform_storage_cap(bigint) from anon';
    execute 'revoke all on function public.consume_daily_upload(text, bigint, bigint) from anon';
    execute 'revoke all on function public.release_daily_upload(text, bigint) from anon';
    execute 'revoke all on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.set_platform_storage_cap(bigint) from authenticated';
    execute 'revoke all on function public.consume_daily_upload(text, bigint, bigint) from authenticated';
    execute 'revoke all on function public.release_daily_upload(text, bigint) from authenticated';
    execute 'revoke all on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.set_platform_storage_cap(bigint) to service_role';
    execute 'grant execute on function public.consume_daily_upload(text, bigint, bigint) to service_role';
    execute 'grant execute on function public.release_daily_upload(text, bigint) to service_role';
    execute 'grant execute on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) to service_role';
  end if;
end $$;
