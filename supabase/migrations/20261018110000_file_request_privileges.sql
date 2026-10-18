-- Apply only after 20261019_transfer_privileges.sql, and only after the
-- request API in functions/lib/r2Engine.js is deployed.
-- This does not delete request rows or transfer files.
-- Until this runs, do not treat browser access to file_requests as safe.
-- The app no longer reads or writes this table from the browser.

alter table public.file_requests enable row level security;
alter table public.file_requests force row level security;

drop policy if exists "file_requests_public_read" on public.file_requests;
drop policy if exists "file_requests_insert_anyone" on public.file_requests;
drop policy if exists "file_requests_update_owner" on public.file_requests;

revoke all on table public.file_requests from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'revoke all on table public.file_requests from authenticator';
  end if;
end $$;

grant all privileges on table public.file_requests to service_role;
