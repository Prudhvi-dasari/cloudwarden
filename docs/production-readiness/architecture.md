# SendToAnyone architecture

The product name is SendToAnyone. The public site is `https://itransfer.iprudhvi.in`. Internal Cloudflare project, bucket, and Worker names still use `itransfer`. Those identifiers are not the product name. This document describes the working tree on branch `phase5-safety-checkpoint-2026-10-18`. It is not a production deploy record.

## Hosting

The frontend is a Vite and React single-page app. Production hosting is Cloudflare Pages project `itransfer-app`. `wrangler.jsonc` sets `pages_build_output_dir` to `dist`, compatibility date `2026-08-20`, and `nodejs_compat`. Pages Functions under `functions/` serve `/api/r2` and `/api/send-email`. The R2 bucket name configured in `wrangler.jsonc` vars is `itransfer-storage`. A service binding named `RATE_LIMITER` points at `itransfer-rate-limit`.

Do not move this frontend to another host to consolidate providers. Vercel is not the production target.

## Request path

The browser uploads directly to object storage with presigned URLs. The Worker signs those URLs and writes transfer rows in Supabase with the service-role key. Recipients download through `/d/:shareId` and `/download/:shareId`, which ask the Worker for a short-lived GET URL.

Local development has two modes:

- Ordinary `npm run dev` refuses `/api/r2` and `/api/payment` with `LOCAL_API_DISABLED`.
- `ITRANSFER_ISOLATED=1` reads `env/isolated` and serves those routes against a local Supabase and MinIO. That mode is not production R2.

## Main routes

Public marketing and product routes live in `src/App.jsx`. Private transfer URLs are `/d/:shareId`, `/download/:shareId`, and `/request/:requestId`. `/transfers` renders the same homepage as `/` and is marked `noindex` in `public/_headers`. SEO landing keys are generated from `SEO_KEYS` onto `SeoLandingPage`.

`public/robots.txt` disallows `/api/`, `/d/`, `/download/`, `/request/`, and token query strings. The sitemap is `https://itransfer.iprudhvi.in/sitemap.xml`.

## Data

Supabase project `tranferfiles` holds Auth and Postgres. Eight migrations are applied on that project. `supabase/migrations/20261022193000_reserve_transfer_file.sql` is in the repository and is not applied. New uploads in this working tree call `public.reserve_transfer_file`. Deploying the Worker before that function exists fails new uploads closed.

The function locks one share, sums occupied rows, and inserts a `pending` row only when the share stays at or under `6_000_000_000` bytes. Occupied statuses exclude `rejected`, `expired`, and `released`.

## Object storage

`functions/lib/r2Engine.js` is the Worker API. `get-put-url` reserves a row and signs one PUT. `initiate-upload` reserves a row and starts multipart. Part URLs and completion continue an existing reservation. Cleanup expires old rows only after object deletion, and it releases abandoned single-PUT reservations only after the object is gone or already missing. A failed delete does not mark a live pending row `released`.

## Mail and auth

Transfer mail is built in `functions/lib/mailService.js` and sent through Resend from `functions/api/send-email.js`. Accepted by the provider is not the same as delivered to a mailbox. Supabase Auth is the account system. The browser keeps a persistent client and a separate anon client for storage calls.

## What is not in this tree

DNS, WAF rules, Turnstile, billing alerts, R2 lifecycle rules, and Resend domain authentication are dashboard settings. They are not verified from this repository.
