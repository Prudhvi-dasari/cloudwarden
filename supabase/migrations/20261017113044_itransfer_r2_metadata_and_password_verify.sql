alter table public.transfers
  add column if not exists storage_provider text not null default 'r2',
  add column if not exists status text not null default 'active';

create index if not exists transfers_share_id_idx on public.transfers (share_id);
create index if not exists transfers_expires_at_idx on public.transfers (expires_at);

create extension if not exists pgcrypto;

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

  if stored is null or stored = '' then
    return true;
  end if;

  digest_hex := encode(extensions.digest(convert_to(p_password, 'utf8'), 'sha256'), 'hex');
  return stored = p_password or stored = digest_hex;
end;
$$;

revoke all on function public.verify_transfer_password(text, text) from public;
grant execute on function public.verify_transfer_password(text, text) to anon, authenticated;;
