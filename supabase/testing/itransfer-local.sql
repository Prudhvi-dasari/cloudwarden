-- Standalone schema for a local iTransfer database.
-- This file is not a Supabase migration. Do not put it in supabase/migrations,
-- do not db push it, and do not apply it to the remote tranferfiles project.
-- The current migration folder cannot create public.transfers or the group tables.
-- Those group tables are unrelated and are intentionally absent here.

create extension if not exists pgcrypto;

-- transfers columns are the ones the engine inserts, selects, or patches,
-- plus defaults from the applied ALTER migrations:
--   storage_provider and status: 20261017113044
--   request_id: 20261017122134
--   multipart_upload_id: 20261018090000
-- Inserts omit id, created_at, download_count, and sometimes max_downloads,
-- so those columns have defaults. recipient_emails is text because the client
-- sends one comma-separated string. No foreign key to auth.users is declared
-- by the engine or by the applied transfer migrations.
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  share_id text not null,
  file_name text not null,
  file_size bigint not null,
  file_path text not null,
  content_type text,
  subject text,
  message text,
  sender_email text,
  recipient_emails text,
  password_hash text,
  user_id uuid,
  transfer_type text not null,
  max_downloads integer not null default 0,
  download_count integer not null default 0,
  expires_at timestamptz not null,
  status text not null default 'active',
  storage_provider text not null default 'r2',
  request_id text,
  multipart_upload_id text,
  created_at timestamptz not null default now()
);

create index if not exists transfers_share_id_idx on public.transfers (share_id);
create index if not exists transfers_expires_at_idx on public.transfers (expires_at);
create index if not exists transfers_request_id_idx on public.transfers (request_id);

-- transfer_claims matches 20261018090000_transfer_claims.sql.
create table if not exists public.transfer_claims (
  id uuid primary key default gen_random_uuid(),
  share_id text not null check (char_length(share_id) between 4 and 80),
  purpose text not null check (purpose in ('claim', 'delete')),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint transfer_claims_purpose_unique unique (share_id, purpose),
  constraint transfer_claims_hash_unique unique (token_hash)
);

create index if not exists transfer_claims_token_hash_idx
  on public.transfer_claims (token_hash);

-- file_requests matches 20261017122134_create_file_requests.sql.
-- The later privilege migration drops the temporary public policies, so this
-- fixture does not recreate those policies.
create table if not exists public.file_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  owner_user_id uuid null,
  owner_email text null,
  title text not null default 'File request',
  instructions text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  status text not null default 'active'
);

create index if not exists file_requests_request_id_idx on public.file_requests (request_id);
create index if not exists file_requests_owner_email_idx on public.file_requests (owner_email);

alter table public.transfers enable row level security;
alter table public.transfers force row level security;
alter table public.transfer_claims enable row level security;
alter table public.transfer_claims force row level security;
alter table public.file_requests enable row level security;
alter table public.file_requests force row level security;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all privileges on table public.transfers from %I', role_name);
      execute format('revoke all privileges on table public.transfer_claims from %I', role_name);
      execute format('revoke all privileges on table public.file_requests from %I', role_name);
    end if;
  end loop;
end
$$;

revoke all privileges on table public.transfers from public;
revoke all privileges on table public.transfer_claims from public;
revoke all privileges on table public.file_requests from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to service_role;
grant all privileges on table public.transfers to service_role;
grant all privileges on table public.transfer_claims to service_role;
grant all privileges on table public.file_requests to service_role;
