-- Optional download-page branding for Pro and Studio.
-- Not applied. Only adds columns on public.itransfer_accounts.
-- Authenticated users may edit their own row. The existing update policy
-- already limits that to auth.uid() = user_id. The worker still checks the plan.

alter table public.itransfer_accounts
  add column if not exists brand_accent text;

alter table public.itransfer_accounts
  add column if not exists brand_background_url text;

alter table public.itransfer_accounts
  add column if not exists brand_message text;

grant update (brand_accent, brand_background_url, brand_message, brand_logo_url)
  on public.itransfer_accounts to authenticated;
