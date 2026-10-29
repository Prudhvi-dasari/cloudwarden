-- Account storage quotas, tier entitlements, one-time passes, and product events.
-- This Supabase project is shared with another app. This file only creates
-- sta_* tables and replaces SendToAnyone functions and the itransfer_accounts
-- plan check. It does not read or write groups, expenses, budgets, or profiles
-- that belong to the other app.
-- Apply after review. This file has not been applied to production.
-- Rollback: restore reserve_transfer_file from 20261029193000_platform_cap_2tb.sql
-- and apply_billing_entitlement plus touch_itransfer_account from
-- 20261029180000_billing_apply_and_reconcile.sql, then drop the sta_* tables.

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

create table if not exists public.sta_product_events (
  id uuid primary key default gen_random_uuid(),
  event text not null check (event in (
    'upload_started',
    'upload_completed',
    'upload_failed',
    'upload_resumed',
    'link_created',
    'download',
    'signup',
    'checkout_started',
    'payment_succeeded',
    'quota_hit',
    'cap_hit'
  )),
  occurred_at timestamptz not null default now(),
  tier text check (tier is null or tier in ('free', 'creator', 'pro', 'studio', 'pass')),
  bytes bigint check (bytes is null or (bytes >= 0 and bytes < 10000000000000))
);

create index if not exists sta_product_events_occurred_idx
  on public.sta_product_events (occurred_at desc);

alter table public.sta_product_events enable row level security;
revoke all on public.sta_product_events from public, anon, authenticated;
grant select, insert on public.sta_product_events to service_role;

create table if not exists public.sta_transfer_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bytes_limit bigint not null,
  retention_hours integer not null,
  status text not null default 'unused' check (status in ('unused', 'used')),
  payment_id text,
  used_share_id text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists sta_transfer_passes_payment_uidx
  on public.sta_transfer_passes (payment_id)
  where payment_id is not null;

create index if not exists sta_transfer_passes_user_status_idx
  on public.sta_transfer_passes (user_id, status);

alter table public.sta_transfer_passes enable row level security;
revoke all on public.sta_transfer_passes from public, anon, authenticated;
grant select, insert, update on public.sta_transfer_passes to service_role;

create index if not exists sta_transfers_user_status_idx
  on public.transfers (user_id, status);

alter table public.itransfer_accounts
  add column if not exists brand_logo_url text;

do $$
declare
  cons record;
begin
  for cons in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.itransfer_accounts'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%plan%'
  loop
    execute format('alter table public.itransfer_accounts drop constraint %I', cons.conname);
  end loop;
end $$;

alter table public.itransfer_accounts
  drop constraint if exists itransfer_accounts_plan_check;

alter table public.itransfer_accounts
  add constraint itransfer_accounts_plan_check
  check (plan in ('free', 'trial', 'creator', 'pro', 'studio'));

grant update (brand_logo_url) on public.itransfer_accounts to authenticated;

create or replace function public.touch_itransfer_account()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then
    new.user_id = old.user_id;
    new.created_at = old.created_at;
    if current_setting('itransfer.billing_write', true) is distinct from 'on' then
      new.plan = old.plan;
      new.trial_started_at = old.trial_started_at;
      new.trial_expires_at = old.trial_expires_at;
      new.plan_expires_at = old.plan_expires_at;
    end if;
  end if;
  if new.plan is null or new.plan not in ('free', 'trial', 'creator', 'pro', 'studio') then
    new.plan = 'free';
  end if;
  return new;
end;
$$;

create or replace function public.billing_user_id_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where p_email is not null
    and length(btrim(p_email)) between 3 and 320
    and lower(email) = lower(btrim(p_email))
  order by created_at asc
  limit 1;
$$;

create or replace function public.apply_billing_entitlement(
  p_user_id uuid,
  p_plan_code text,
  p_status text,
  p_payment_id text,
  p_subscription_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  period interval;
  next_expiry timestamptz;
  account_plan text;
  payment text := nullif(btrim(p_payment_id), '');
begin
  if p_user_id is null
    or p_status not in ('pending', 'active', 'failed', 'cancelled', 'expired')
    or p_plan_code is null
    or p_plan_code not in (
      'monthly', 'yearly', 'creator_monthly', 'pro_monthly', 'pro_yearly',
      'studio_monthly', 'pass', 'creator', 'pro', 'studio'
    )
  then
    return jsonb_build_object('ok', false, 'code', 'BILLING_INVALID');
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
  end if;

  -- A pass is one transfer credit. It must not replace an active subscription.
  if p_plan_code = 'pass' then
    if p_status = 'active' then
      insert into public.sta_transfer_passes (
        user_id, bytes_limit, retention_hours, status, payment_id
      ) values (
        p_user_id, 100000000000, 720, 'unused', payment
      )
      on conflict (payment_id) where payment_id is not null do nothing;
    elsif payment is not null and p_status in ('failed', 'cancelled', 'expired') then
      update public.sta_transfer_passes
        set status = 'used',
            used_at = coalesce(used_at, now())
        where payment_id = payment
          and status = 'unused';
    end if;
    return jsonb_build_object('ok', true, 'user_id', p_user_id, 'status', p_status, 'tier', 'pass');
  end if;

  account_plan := case
    when p_plan_code in ('creator_monthly', 'creator') then 'creator'
    when p_plan_code in ('studio_monthly', 'studio') then 'studio'
    else 'pro'
  end;

  insert into public.billing_entitlements (
    user_id, plan_code, status, provider_payment_id, provider_subscription_id, updated_at
  ) values (
    p_user_id,
    p_plan_code,
    p_status,
    payment,
    nullif(btrim(p_subscription_id), ''),
    now()
  )
  on conflict (user_id) do update set
    plan_code = excluded.plan_code,
    status = excluded.status,
    provider_payment_id = coalesce(excluded.provider_payment_id, public.billing_entitlements.provider_payment_id),
    provider_subscription_id = coalesce(excluded.provider_subscription_id, public.billing_entitlements.provider_subscription_id),
    updated_at = now();

  insert into public.itransfer_accounts (user_id, email, plan)
  select p_user_id, u.email, 'free'
  from auth.users u
  where u.id = p_user_id
  on conflict (user_id) do nothing;

  perform set_config('itransfer.billing_write', 'on', true);

  if p_status = 'active' then
    period := case
      when p_plan_code in ('yearly', 'pro_yearly') then interval '366 days'
      else interval '32 days'
    end;
    update public.itransfer_accounts
      set plan = account_plan,
          plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + period
      where user_id = p_user_id
      returning plan_expires_at into next_expiry;
  elsif p_status in ('failed', 'cancelled', 'expired') then
    update public.itransfer_accounts
      set plan = 'free',
          plan_expires_at = now()
      where user_id = p_user_id
        and plan in ('creator', 'pro', 'studio');
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'status', p_status,
    'tier', account_plan,
    'plan_expires_at', next_expiry
  );
end;
$$;

create or replace function public.reconcile_billing_by_email(
  p_email text,
  p_plan_code text,
  p_payment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if p_plan_code is null or p_plan_code not in (
    'monthly', 'yearly', 'creator_monthly', 'pro_monthly', 'pro_yearly',
    'studio_monthly', 'pass', 'creator', 'pro', 'studio'
  ) then
    return jsonb_build_object('ok', false, 'code', 'BILLING_PLAN');
  end if;
  uid := public.billing_user_id_for_email(p_email);
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'EMAIL_NOT_FOUND');
  end if;
  return public.apply_billing_entitlement(uid, p_plan_code, 'active', p_payment_id, null);
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
  account_used bigint := 0;
  new_id uuid;
  uid uuid;
  ent_plan text;
  paid boolean := false;
  using_pass boolean := false;
  pass_id uuid;
  share_limit bigint;
  storage_limit bigint;
  max_hours integer;
  platform_limit bigint := 2000000000000;
  soft_ratio numeric := 0.9;
  free_transfer constant bigint := 6000000000;
  creator_transfer constant bigint := 50000000000;
  creator_storage constant bigint := 200000000000;
  pro_transfer constant bigint := 250000000000;
  pro_storage constant bigint := 1000000000000;
  studio_transfer constant bigint := 250000000000;
  studio_storage constant bigint := 3 * 1000000000000;
  pass_transfer constant bigint := 100000000000;
  pass_hours constant integer := 720;
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

  share_limit := free_transfer;
  storage_limit := free_transfer;
  max_hours := 168;

  if nullif(btrim(p_user_id), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    uid := nullif(btrim(p_user_id), '')::uuid;
    select e.plan_code into ent_plan
    from public.billing_entitlements e
    where e.user_id = uid
      and e.status = 'active';

    if ent_plan is null and found then
      ent_plan := 'pro';
    end if;

    if ent_plan in ('monthly', 'yearly', 'pro_monthly', 'pro_yearly', 'pro')
      or (ent_plan is not null and btrim(ent_plan) = '')
    then
      paid := true;
      share_limit := pro_transfer;
      storage_limit := pro_storage;
      max_hours := 4320;
    elsif ent_plan in ('creator_monthly', 'creator') then
      paid := true;
      share_limit := creator_transfer;
      storage_limit := creator_storage;
      max_hours := 720;
    elsif ent_plan in ('studio_monthly', 'studio') then
      paid := true;
      share_limit := studio_transfer;
      storage_limit := studio_storage;
      max_hours := 8760;
    end if;
  end if;

  if p_file_size is null or p_file_size <= 0 then
    return jsonb_build_object('ok', false, 'code', 'TRANSFER_TOO_LARGE');
  end if;

  perform pg_advisory_xact_lock(hashtext('itransfer-platform-v1'), 0);
  perform pg_advisory_xact_lock(hashtext('itransfer-share-v1'), hashtext(p_share_id));

  if uid is not null then
    select coalesce(sum(file_size), 0)
      into account_used
    from public.transfers
    where user_id = uid
      and coalesce(status, 'active') not in ('rejected', 'expired', 'released');

    select p.id into pass_id
    from public.sta_transfer_passes p
    where p.user_id = uid
      and p.status = 'used'
      and p.used_share_id = p_share_id
    limit 1;

    if pass_id is not null then
      using_pass := true;
      share_limit := pass_transfer;
      max_hours := greatest(max_hours, pass_hours);
    elsif p_file_size > share_limit
      or p_expires_at > now() + make_interval(hours => max_hours + 1)
      or account_used + p_file_size > storage_limit
    then
      select p.id into pass_id
      from public.sta_transfer_passes p
      where p.user_id = uid
        and p.status = 'unused'
        and p.bytes_limit >= p_file_size
      order by p.created_at
      for update skip locked
      limit 1;

      if pass_id is not null
        and p_file_size <= pass_transfer
        and p_expires_at <= now() + make_interval(hours => pass_hours + 1)
      then
        update public.sta_transfer_passes
          set status = 'used',
              used_share_id = p_share_id,
              used_at = now()
          where id = pass_id
            and status = 'unused';
        if found then
          using_pass := true;
          share_limit := pass_transfer;
          max_hours := greatest(max_hours, pass_hours);
        end if;
      end if;
    end if;
  end if;

  if p_file_size > share_limit then
    return jsonb_build_object('ok', false, 'code', 'TRANSFER_TOO_LARGE');
  end if;

  if p_expires_at > now() + make_interval(hours => max_hours + 1) then
    return jsonb_build_object('ok', false, 'code', 'EXPIRY_TOO_LONG');
  end if;

  select coalesce(sum(file_size), 0)
    into occupied
  from public.transfers
  where share_id = p_share_id
    and coalesce(status, 'active') not in ('rejected', 'expired', 'released');

  if occupied + p_file_size > share_limit then
    return jsonb_build_object('ok', false, 'code', 'TRANSFER_TOO_LARGE');
  end if;

  if uid is not null and not using_pass and account_used + p_file_size > storage_limit then
    return jsonb_build_object('ok', false, 'code', 'ACCOUNT_QUOTA', 'used', account_used, 'quota', storage_limit);
  end if;

  select coalesce(sum(file_size), 0)
    into platform
  from public.transfers
  where coalesce(status, 'active') not in ('rejected', 'expired', 'released');

  if not paid and not using_pass and platform + p_file_size > floor(platform_limit * soft_ratio) then
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
    uid,
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

revoke all on function public.billing_user_id_for_email(text) from public;
revoke all on function public.apply_billing_entitlement(uuid, text, text, text, text) from public;
revoke all on function public.reconcile_billing_by_email(text, text, text) from public;
revoke all on function public.reserve_transfer_file(
  text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.billing_user_id_for_email(text) from anon';
    execute 'revoke all on function public.apply_billing_entitlement(uuid, text, text, text, text) from anon';
    execute 'revoke all on function public.reconcile_billing_by_email(text, text, text) from anon';
    execute 'revoke all on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) from anon';
    execute 'revoke all on public.sta_product_events from anon';
    execute 'revoke all on public.sta_transfer_passes from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.billing_user_id_for_email(text) from authenticated';
    execute 'revoke all on function public.apply_billing_entitlement(uuid, text, text, text, text) from authenticated';
    execute 'revoke all on function public.reconcile_billing_by_email(text, text, text) from authenticated';
    execute 'revoke all on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) from authenticated';
    execute 'revoke all on public.sta_product_events from authenticated';
    execute 'revoke all on public.sta_transfer_passes from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.billing_user_id_for_email(text) to service_role';
    execute 'grant execute on function public.apply_billing_entitlement(uuid, text, text, text, text) to service_role';
    execute 'grant execute on function public.reconcile_billing_by_email(text, text, text) to service_role';
    execute 'grant execute on function public.reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text) to service_role';
    execute 'grant select, insert on public.sta_product_events to service_role';
    execute 'grant select, insert, update on public.sta_transfer_passes to service_role';
  end if;
end $$;
