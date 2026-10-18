-- File request portals owned by users/guests
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

alter table public.transfers
  add column if not exists request_id text null;

create index if not exists transfers_request_id_idx on public.transfers (request_id);

alter table public.file_requests enable row level security;

drop policy if exists "file_requests_public_read" on public.file_requests;
create policy "file_requests_public_read" on public.file_requests
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "file_requests_insert_anyone" on public.file_requests;
create policy "file_requests_insert_anyone" on public.file_requests
  for insert to anon, authenticated
  with check (true);

drop policy if exists "file_requests_update_owner" on public.file_requests;
create policy "file_requests_update_owner" on public.file_requests
  for update to anon, authenticated
  using (true);
;
