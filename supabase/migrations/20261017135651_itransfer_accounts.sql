create table if not exists public.itransfer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'trial', 'pro')),
  theme text not null default 'indigo',
  trial_started_at timestamptz,
  trial_expires_at timestamptz,
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.itransfer_accounts enable row level security;

drop policy if exists itransfer_accounts_select_own on public.itransfer_accounts;
create policy itransfer_accounts_select_own
  on public.itransfer_accounts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists itransfer_accounts_insert_own on public.itransfer_accounts;
create policy itransfer_accounts_insert_own
  on public.itransfer_accounts
  for insert
  to authenticated
  with check (auth.uid() = user_id and plan = 'free');

drop policy if exists itransfer_accounts_update_own on public.itransfer_accounts;
create policy itransfer_accounts_update_own
  on public.itransfer_accounts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.itransfer_accounts from anon;
grant select, insert on public.itransfer_accounts to authenticated;
grant update (display_name, theme, email, updated_at) on public.itransfer_accounts to authenticated;

create or replace function public.touch_itransfer_account()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then
    new.user_id = old.user_id;
    new.plan = old.plan;
    new.trial_started_at = old.trial_started_at;
    new.trial_expires_at = old.trial_expires_at;
    new.plan_expires_at = old.plan_expires_at;
    new.created_at = old.created_at;
  end if;
  if new.plan is null or new.plan not in ('free', 'trial', 'pro') then
    new.plan = 'free';
  end if;
  return new;
end;
$$;

drop trigger if exists itransfer_accounts_touch on public.itransfer_accounts;
create trigger itransfer_accounts_touch
  before insert or update on public.itransfer_accounts
  for each row execute function public.touch_itransfer_account();

create or replace function public.start_itransfer_trial()
returns public.itransfer_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.itransfer_accounts;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Sign in required';
  end if;

  insert into public.itransfer_accounts (user_id, email, plan)
  select caller, u.email, 'free'
  from auth.users u
  where u.id = caller
  on conflict (user_id) do nothing;

  select * into row from public.itransfer_accounts where user_id = caller;
  if row.plan = 'pro' or row.trial_started_at is not null then
    return row;
  end if;

  update public.itransfer_accounts
    set plan = 'trial',
        trial_started_at = now(),
        trial_expires_at = now() + interval '7 days'
    where user_id = caller
    returning * into row;
  return row;
end;
$$;

revoke all on function public.start_itransfer_trial() from public, anon;
grant execute on function public.start_itransfer_trial() to authenticated;;
