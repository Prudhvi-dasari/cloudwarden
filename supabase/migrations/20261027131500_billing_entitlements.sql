-- Additive billing records for verified Dodo webhooks.
-- Does not change transfer quotas, reserve_transfer_file, or existing account plans.
-- Apply only after review. This file has not been applied to production.

create table if not exists public.billing_events (
  webhook_id text primary key,
  event_type text not null,
  user_id uuid,
  plan_code text,
  outcome text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null,
  status text not null check (status in ('pending', 'active', 'failed', 'cancelled', 'expired')),
  provider_payment_id text,
  provider_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;
alter table public.billing_entitlements enable row level security;

revoke all on public.billing_events from public, anon, authenticated;
revoke all on public.billing_entitlements from public, anon, authenticated;

grant select on public.billing_entitlements to authenticated;

drop policy if exists billing_entitlements_select_own on public.billing_entitlements;
create policy billing_entitlements_select_own
  on public.billing_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);
