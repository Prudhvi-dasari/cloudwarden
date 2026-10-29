-- Download history and sender alerts. No IP addresses.
-- This file has not been applied. It only adds sta_* objects and one column
-- on public.transfers, which belongs to SendToAnyone.
-- It does not read or write the other app's tables.

create table if not exists public.sta_download_events (
  id uuid primary key default gen_random_uuid(),
  share_id text not null,
  file_id uuid,
  download_count integer not null default 1,
  occurred_at timestamptz not null default now()
);

create index if not exists sta_download_events_share_idx
  on public.sta_download_events (share_id, occurred_at desc);

alter table public.sta_download_events enable row level security;
revoke all on public.sta_download_events from public, anon, authenticated;
grant select, insert on public.sta_download_events to service_role;

create table if not exists public.sta_alert_optouts (
  token text primary key,
  created_at timestamptz not null default now()
);

alter table public.sta_alert_optouts enable row level security;
revoke all on public.sta_alert_optouts from public, anon, authenticated;
grant select, insert on public.sta_alert_optouts to service_role;

alter table public.transfers
  add column if not exists alert_mode text not null default 'first';

alter table public.transfers
  drop constraint if exists transfers_alert_mode_check;

alter table public.transfers
  add constraint transfers_alert_mode_check
  check (alert_mode in ('off', 'first', 'each'));
