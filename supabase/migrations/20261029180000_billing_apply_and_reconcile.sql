-- Lets a verified Dodo webhook attach a plan to the signed-in account.
-- touch_itransfer_account otherwise copies the old plan back on every update,
-- including service-role updates, so billing never changed itransfer_accounts.
-- Apply in the Supabase SQL editor. This file does not change transfer bytes.
-- Rollback: restore touch_itransfer_account from 20261017135651_itransfer_accounts.sql
-- and drop the three functions below.

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
  if new.plan is null or new.plan not in ('free', 'trial', 'pro') then
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
begin
  if p_user_id is null
    or p_status not in ('pending', 'active', 'failed', 'cancelled', 'expired')
    or (p_plan_code is not null and p_plan_code not in ('monthly', 'yearly'))
  then
    return jsonb_build_object('ok', false, 'code', 'BILLING_INVALID');
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
  end if;

  insert into public.billing_entitlements (
    user_id, plan_code, status, provider_payment_id, provider_subscription_id, updated_at
  ) values (
    p_user_id,
    coalesce(p_plan_code, 'monthly'),
    p_status,
    nullif(btrim(p_payment_id), ''),
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
    period := case when p_plan_code = 'yearly' then interval '366 days' else interval '32 days' end;
    update public.itransfer_accounts
      set plan = 'pro',
          plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + period
      where user_id = p_user_id
      returning plan_expires_at into next_expiry;
  elsif p_status in ('failed', 'cancelled', 'expired') then
    update public.itransfer_accounts
      set plan = 'free',
          plan_expires_at = now()
      where user_id = p_user_id
        and plan = 'pro';
  end if;

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'status', p_status, 'plan_expires_at', next_expiry);
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
  if p_plan_code not in ('monthly', 'yearly') then
    return jsonb_build_object('ok', false, 'code', 'BILLING_PLAN');
  end if;
  uid := public.billing_user_id_for_email(p_email);
  if uid is null then
    return jsonb_build_object('ok', false, 'code', 'EMAIL_NOT_FOUND');
  end if;
  return public.apply_billing_entitlement(uid, p_plan_code, 'active', p_payment_id, null);
end;
$$;

revoke all on function public.billing_user_id_for_email(text) from public;
revoke all on function public.apply_billing_entitlement(uuid, text, text, text, text) from public;
revoke all on function public.reconcile_billing_by_email(text, text, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.billing_user_id_for_email(text) from anon';
    execute 'revoke all on function public.apply_billing_entitlement(uuid, text, text, text, text) from anon';
    execute 'revoke all on function public.reconcile_billing_by_email(text, text, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.billing_user_id_for_email(text) from authenticated';
    execute 'revoke all on function public.apply_billing_entitlement(uuid, text, text, text, text) from authenticated';
    execute 'revoke all on function public.reconcile_billing_by_email(text, text, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.billing_user_id_for_email(text) to service_role';
    execute 'grant execute on function public.apply_billing_entitlement(uuid, text, text, text, text) to service_role';
    execute 'grant execute on function public.reconcile_billing_by_email(text, text, text) to service_role';
  end if;
end $$;
