-- Additive claim and delete tokens for iTransfer.
-- Does not revoke or rewrite privileges on public.transfers.
-- Does not enable quota enforcement.
-- Do not execute until the Worker that writes these rows is approved.
--
-- Rollback after a reverted Worker, and only if no claim or delete is in progress:
--   drop table if exists public.transfer_claims;
--   alter table public.transfers drop column if exists multipart_upload_id;
-- Existing transfer rows and R2 objects are left in place.

create extension if not exists pgcrypto;

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

alter table public.transfers
  add column if not exists multipart_upload_id text;

alter table public.transfer_claims enable row level security;

-- New table only. No policy is created, so anon and authenticated cannot read token hashes.
-- service_role bypasses RLS. Existing transfer policies are unchanged.
revoke all on table public.transfer_claims from public, anon, authenticated;
grant all privileges on table public.transfer_claims to service_role;

-- The existing public password check accepts the stored hash as the password.
-- This replacement accepts a SHA-256 hex row only when the typed password hashes to it.
-- A non-hex legacy value can still match the typed password itself.
create or replace function public.verify_transfer_password(p_share_id text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored text;
  digest_hex text;
begin
  if p_share_id is null or p_password is null or length(p_password) = 0 or length(p_password) > 200 then
    return false;
  end if;

  select t.password_hash into stored
  from public.transfers t
  where t.share_id = p_share_id
  order by t.created_at asc nulls last
  limit 1;

  if not found then
    return false;
  end if;

  if stored is null or stored = '' then
    return true;
  end if;

  digest_hex := encode(extensions.digest(convert_to(p_password, 'utf8'), 'sha256'), 'hex');
  if stored ~ '^[a-f0-9]{64}$' then
    return stored = digest_hex;
  end if;
  return stored = p_password;
end;
$$;
