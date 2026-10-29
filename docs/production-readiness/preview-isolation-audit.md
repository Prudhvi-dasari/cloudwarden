# Preview isolation audit

Date: 23 October 2026, Phase 5B. No Preview deployment was created. No Production setting, secret, binding, bucket, or database was changed.

Conclusion: Preview is not safe for integration testing. The account has no separate Supabase project and no R2 bucket other than production `itransfer-storage`. The preview rate-limit Worker does not exist. The two live Preview deployments are still source `4bce02c`, which does not contain this guard.

## Implemented repository guard

`functions/lib/previewGuard.js` treats a request as Preview only when its hostname is a subdomain of `itransfer-app.pages.dev` and `CF_PAGES_BRANCH` is not `main` or `master`. Requests to `itransfer.iprudhvi.in`, `sendtoanyone.com`, and `itransfer-app.pages.dev` keep the existing production fallbacks. A production deployment opened on its hash URL stays on the production path when the branch is `main`.

On a Preview request, the transfer API, transfer email, and payment route return HTTP 503 `PREVIEW_ISOLATION_REQUIRED` before any database, storage, or provider call when configuration is missing or points at production. Preview email does not call Resend unless `PREVIEW_EMAIL_MODE=allowlist` and every recipient is listed.

`env/preview.example` and `wrangler.rate-limit.preview.jsonc` are local templates. The preview Worker file uses namespaces `910101`–`910108`, separate from production `910001`–`910008`. Neither has been deployed.

On a Preview hostname the guard now also requires a non-empty publishable key, a `preview-` cleanup secret, a `RATE_LIMITER` binding, and `RATE_LIMIT_SCOPE=preview`. A branch alias such as `phase5-rate-limit-test.itransfer-app.pages.dev` and a deployment hash such as `deadbeef.itransfer-app.pages.dev` stay on the Preview path when `CF_PAGES_BRANCH` is not `main` or `master`. The production custom domains and `itransfer-app.pages.dev` keep the existing fallbacks. A production deployment hash stays on the production path only when Cloudflare sets the branch to `main` or `master`.

## Phase 5B resource inventory

Read on 23 October 2026. No secret values were read.

| Resource | What exists | Isolation |
| --- | --- | --- |
| Supabase organization `iprudhvi` (`vfbpzlkattnaxqaxcwiz`) | Free plan. Two active projects, which is the free-project quota | A third project was not created. The cost API reported $0 per month for a project, and the free-plan docs say a third active project is not allowed |
| Project `iprudhvi` (`insxifwdufjzfqzzufxz`) | Portfolio tables (`Blog`, `Project`, `Experience`, and others) in `ap-northeast-1` | Not a transfer database. It was not reused |
| Project `tranferfiles` (`giyeepztahdbsejsozog`) | Production transfer database in `ap-northeast-2`. No development branches | Production. A branch was not created. The cost API reported $0.01344 per hour for a branch |
| R2 buckets | Only `itransfer-storage`, created 2026-10-17 | Production bucket. No test bucket exists. One was not created, because there is no separate database to pair with it |
| Worker `itransfer-rate-limit-preview` | Cloudflare API code 10007: this Worker does not exist | The local config was not deployed |
| Preview Pages deployments | `9525312e` and `d62cc19b`, branch `phase5-rate-limit-test`, source `4bce02c` | Same source label as the current Production deployment. Not this working tree. `RATE_LIMITER` is still absent |
| Resend | Production secret names exist. Domain verification was not opened. No test recipient is configured | Preview email stays disabled unless an allowlist is set. No message was sent |
| Local Docker Supabase and MinIO | The loopback rewrite was started and stopped on 23 October 2026 | `lsof` showed `127.0.0.1:55421` through `127.0.0.1:55424` only. MinIO remains on loopback with bucket `itransfer-local` |

`wrangler pages deploy` was not run. Deploying the current `wrangler.jsonc` would attach `RATE_LIMITER` to the production Worker `itransfer-rate-limit` and would set the production bucket and `APP_URL`. That deploy is blocked until a separate project, a separate bucket, and `itransfer-rate-limit-preview` exist.

## Phase 5 closeout read

On 23 October 2026 the same two Preview deployments were still the latest, both source `4bce02c`. `npx wrangler pages secret list --project-name itransfer-app --env preview` printed no secret names. A public `GET /api/r2?action=health` on `https://9525312e.itransfer-app.pages.dev` returned HTTP 200, `configured: false`, `runtime: workers`, and bucket `itransfer-storage`. `tier-limits` returned the 6 GB free tier. The source guard would have returned HTTP 503 `PREVIEW_ISOLATION_REQUIRED` on that host before health, because Preview has no encrypted secrets and the reported bucket name is the production bucket. No sign-in, upload, download, or cleanup was sent.

## What was inspected

Git branch `phase5-safety-checkpoint-2026-10-18`, HEAD `9712b80`. Existing edits were left in place.

`wrangler.jsonc` has one variable block and no `env.preview` block. The variables in that file are `CLOUDFLARE_R2_BUCKET=itransfer-storage` and `APP_URL=https://itransfer.iprudhvi.in`. A later `wrangler pages download config` showed those same two plain values, plus `RATE_LIMITER` → `itransfer-rate-limit`, on both the Preview and Production project configs.

`npx wrangler pages deployment list --project-name itransfer-app --environment preview` returned two Preview deployments. Both are branch `phase5-rate-limit-test`, source `4bce02c`, about four days old:

- `https://9525312e.itransfer-app.pages.dev`
- `https://d62cc19b.itransfer-app.pages.dev`

That source label is the same commit previously recorded for the latest Production deployment. It is not this working tree. `pages secret list` was not run in this pass. An earlier pass listed Production secret names only. Preview secret names and every encrypted value remain unread.

The Preview settings already reported for this project are `APP_URL=https://itransfer.iprudhvi.in` and bucket name `itransfer-storage`. This pass did not open the dashboard again and did not print those values from Cloudflare.

## Controls

| Control | Status | Evidence | What it means |
| --- | --- | --- | --- |
| Separate Supabase project | Missing in the repo. Live Preview target unverified | The repo has one remote project, `tranferfiles` (`giyeepztahdbsejsozog`). Pages Functions use `SUPABASE_URL` when set. If it is empty, `functions/lib/r2Engine.js` uses `https://giyeepztahdbsejsozog.supabase.co`. The browser build uses `VITE_SUPABASE_URL` when it was present at build time, otherwise the same production host | A Preview upload or file request can write the production database. The encrypted service-role key was not read, so its project was not confirmed |
| Separate R2 bucket | Missing | Reported Preview bucket is `itransfer-storage`. That is the production bucket. An empty `CLOUDFLARE_R2_BUCKET` also falls back to `itransfer-storage` | A Preview upload signs a PUT to the production bucket when the Preview R2 key is allowed to write there. The key value was not read |
| Test-only R2 credentials | Unverified | Production secret names recorded earlier include `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_ACCOUNT_ID`, and `CLOUDFLARE_R2_SECRET_ACCESS_KEY`. Preview copies of those names were not listed | The account owner has to confirm the Preview key is a different token, scoped to a non-production bucket |
| Test-only database credentials | Unverified | Production has an encrypted `SUPABASE_SERVICE_ROLE_KEY`. Preview’s value was not read | A Preview service-role key for `giyeepztahdbsejsozog` bypasses row security on production |
| Supabase Auth stays off production | Missing for the built client | `src/lib/supabase.js` uses the production project when `VITE_SUPABASE_URL` is absent from the production build. Google sign-in and password reset use `window.location.origin` | A Preview sign-in talks to production Auth if the bundle has the production URL. Whether the dashboard allows the Preview origin is still unverified |
| Transfer links stay off the production site | Missing | Reported Preview `APP_URL` is `https://itransfer.iprudhvi.in`. Empty `APP_URL` uses that same origin in `applicationOrigin` | Mail and payment return links point at the live site |
| Email sender is test-only | Unverified | Production has encrypted `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS`. Preview values were not read. The code default From is `SendToAnyone <send@sendtoanyone.com>` only when the From secret is empty | A Preview email can send through the production Resend account and land in a real inbox |
| Cleanup cannot delete production objects | Unverified | Production has encrypted `CLEANUP_SECRET`. The scheduler calls `https://itransfer.iprudhvi.in`, not a Preview host. A person can still call cleanup on a Preview URL | If Preview has the production cleanup secret and the production R2 key, that call deletes production objects |
| `RATE_LIMITER` binding | Not configured | Dashboard confirmed no binding on Production or Preview. API 10007: `itransfer-rate-limit-preview` does not exist | Adding a binding to the production Worker would share production counters. That binding was not added |
| Rate-limit counters are separate | Missing on Cloudflare | The deployed Worker uses namespaces `910001` through `910008`. The local preview config uses `910101` through `910108` and has not been deployed | Preview and Production would share counters only if both were bound to `itransfer-rate-limit` |
| Preview code matches this working tree | Missing | Preview deployments are source `4bce02c` | A binding test on those URLs does not test the current Pages client |

## Settings the Functions read

Pages serves `functions/api/r2.js`, `functions/api/send-email.js`, `functions/api/payment.js`, `functions/api/geo.js`, and a retired `functions/api/drive.js`. The legacy `api/` directory is not the Pages runtime.

| Setting | Used for | If Preview matches Production |
| --- | --- | --- |
| `SUPABASE_URL` | Database and Auth API. Empty means the production project | Production rows |
| `SUPABASE_SERVICE_ROLE_KEY` | Reservations, downloads, cleanup, file requests | Production writes, past row security |
| `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` | Checking the signed-in user. Empty means the production publishable key baked into `r2Engine.js` | Production Auth |
| `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser Auth, baked in at build time | Production Auth from the browser |
| `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Signing upload and download URLs | Production objects if the token allows `itransfer-storage` |
| `CLOUDFLARE_R2_BUCKET` | Bucket name. Empty means `itransfer-storage` | Production bucket |
| `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_REGION` | Non-Cloudflare storage. Empty means Cloudflare R2 | Production R2 |
| `APP_URL` | Links in transfer mail. Empty means `https://itransfer.iprudhvi.in` | Production links |
| `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO` | From and reply-to | Production sender when the secret is the production one |
| `RESEND_API_KEY` | Sending mail | Real mail |
| `CLEANUP_SECRET` | Cleanup, direct delete, and CORS repair | Production deletes when the R2 key is production |
| `UPLOADS_PAUSED` | Stops new reservations and part URLs when `1` or `true` | Not an isolation control |
| `RATE_LIMITER` | Shared limit Worker | Not attached. One Worker serves every environment that binds it |
| `DODO_API_KEY`, `DODO_ENV`, `DODO_PRODUCT_MONTHLY`, `DODO_PRODUCT_YEARLY` | Checkout in `functions/lib/dodo.js` | A live key can create a real charge. Paid features stay off in the transfer policy. Whether Preview sets these is unverified |
| `ITRANSFER_ISOLATED` | Local Vite guard. Must stay unset on Pages | Setting it on the current Preview would not create a separate database |

`env/isolated.example` is the local test profile. It is not the Cloudflare Preview environment.

## What a Preview action can change

| Action on a current Preview URL | Production effect |
| --- | --- |
| Upload or multipart upload | Can create a production database row and a production R2 object |
| File request, claim, rename, delete | Can change production rows and objects |
| Sign-in, sign-up, password reset | Can use production Auth. The reset link uses the Preview origin only if that origin is allowed |
| Send transfer email | Can send real mail whose link opens the production site |
| Cleanup | Can delete production objects if the Preview secret and R2 key are the production ones. The hourly scheduler, if it is live, calls the production host |
| Health or tier-limits | Read the configuration flag. They do not reserve a file |
| Rate-limit binding by itself | No file or mail write. Tests that then upload, authenticate, or email still hit the resources above |

## Account owner confirmation

Encrypted values cannot show their target from here. In Workers & Pages → `itransfer-app` → Settings → Variables and Secrets, open Preview and record only yes or no. Do not copy a secret into chat or into this file.

| Question | Safe answer |
| --- | --- |
| Is Preview `SUPABASE_URL` a project other than `giyeepztahdbsejsozog`? | Yes, before any Preview write |
| Is Preview `CLOUDFLARE_R2_BUCKET` something other than `itransfer-storage`? | Yes |
| Is the Preview R2 token a different token, limited to that other bucket? | Yes. The dashboard will not show the secret. Confirm it from the token’s creation, or create a new Preview-only token without rotating Production |
| Is Preview `SUPABASE_SERVICE_ROLE_KEY` from that other project? | Yes. Same constraint: do not reveal it |
| Is Preview `RESEND_API_KEY` empty or a key that cannot send as the production domain? | Yes |
| Is Preview `EMAIL_FROM_ADDRESS` a test sender? | Yes |
| Is Preview `APP_URL` an `https://*.pages.dev` origin, not `itransfer.iprudhvi.in` or `sendtoanyone.com`? | Yes |
| Is Preview `CLEANUP_SECRET` different from Production? | Yes |
| Are `DODO_API_KEY` and the product ids absent, or clearly a test account? | Yes |

Until those answers are yes, Preview is not a safe place to test the limiter with real product actions.

## How to test the Worker after isolation

The Worker has no public route. The only application path is the Preview service binding.

1. Keep Production’s bindings and deployment as they are.
2. Point Preview at a separate Supabase project, a separate bucket, and test-only mail credentials. Confirm the table above.
3. Deploy Preview from the Pages client that speaks this protocol. The deployments that exist today are source `4bce02c`, so they are the wrong build for this test.
4. Add the Preview binding only: service binding name `RATE_LIMITER`, service `itransfer-rate-limit-preview`, plus plain variable `RATE_LIMIT_SCOPE=preview`. Do not bind Preview to `itransfer-rate-limit`. Add the binding before the Preview deploy, because a deploy made without the binding fail-closes.
5. On the new Preview URL, make one allowed request and one request that should return 429. Use a normal browser, not a loop. Those counters belong to `itransfer-rate-limit-preview` only when the binding names that Worker.
6. Do not call cleanup. Do not send mail until the Resend key is a test key. Do not add the Production binding in the same step.

Production still does not have the reservation SQL. Do not deploy this working tree to Production to “finish” the Preview test.
