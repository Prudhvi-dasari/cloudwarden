# SendToAnyone Cloudflare configuration checklist

Documentation only. Nothing in this file was changed in Cloudflare, DNS, R2, or Pages. Public DNS and HTTPS were read on 23 October 2026. A later read-only Wrangler pass on the same day used the already logged-in account `iprudhvidasari@gmail.com`, account id `e300e372a7b243402f04adf0900aab6d`. Wrangler 4.151.1. No login, deploy, or write command was run.

## Read-only Wrangler results

| Item | Status | Evidence | Manual action |
| --- | --- | --- | --- |
| Login | Verified | `npx wrangler whoami` succeeded. The first sandbox attempt could not reach Cloudflare and was retried outside the sandbox. | None |
| R2 public r2.dev URL | Verified disabled | `npx wrangler r2 bucket dev-url get itransfer-storage` said public access via the r2.dev URL is disabled | Do not enable it |
| R2 lifecycle | Verified, one rule | `npx wrangler r2 bucket lifecycle list itransfer-storage`: `Default Multipart Abort Rule`, enabled, all prefixes, abort incomplete multipart uploads after 7 days. No completed-object expiration rule was listed | Do not add a rule that deletes finished objects. See the lifecycle note below |
| R2 CORS | Verified | `npx wrangler r2 bucket cors list itransfer-storage`: origin `*`, methods GET, PUT, HEAD, POST, header `*`, exposed `ETag` and `Content-Length`, max age 3600. This matches `ensure-cors` in `functions/lib/r2Engine.js` | None. CORS `*` does not make an unsigned object public |
| Pages domains | Verified | `npx wrangler pages project list`: project `itransfer-app` has `itransfer-app.pages.dev`, `itransfer.iprudhvi.in`, and `sendtoanyone.com`. Git provider is No | Keep `itransfer.iprudhvi.in` as the canonical URL. `sendtoanyone.com` is attached, and the live canonical tag still points at `itransfer.iprudhvi.in` |
| Pages production secrets | Verified names, values not read | `npx wrangler pages secret list --project-name itransfer-app` for production: `CLEANUP_SECRET`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `EMAIL_FROM_ADDRESS`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Each line said `Value Encrypted` | Do not print or rotate them in this phase |
| Plain Pages variables and the `RATE_LIMITER` binding | Project config has the binding. Serving deployment UNVERIFIED | `wrangler pages download config` on 23 October 2026 showed Production and Preview `APP_URL=https://itransfer.iprudhvi.in`, bucket `itransfer-storage`, and `RATE_LIMITER` → `itransfer-rate-limit`. No secret values were in that file. Deployment `aa8a4342` does not carry its own binding snapshot. The Pages docs say a service binding takes effect on redeploy | Do not add or remove the binding. A later deploy has to read this config again |
| Rate-limit Worker | VERIFIED deployed. Pages attachment UNVERIFIED | `itransfer-rate-limit` version `8a09e891-6c9d-4508-996a-8038487f4ae3` is still at 100 percent, created 18 October 2026. An earlier version view listed upload 30/60s, parts 120/60s, download 120/60s, password 8/60s, claim 20/60s, delete 20/60s, request 10/60s, and email 5/60s. The script bytes were not downloaded. Whether the serving Pages deployment has `env.RATE_LIMITER` was not visible from `pages deployment list` or `pages secret list` | Confirm the binding on the serving deployment before treating those limits as active |
| Turnstile | NOT CONFIGURED | `npx wrangler turnstile widget list` on 23 October 2026 returned `No Turnstile widgets found.` | Do not create one |
| WAF | UNVERIFIED | Wrangler 4.151.1 has no command that lists WAF custom rules, managed rules, or rate-limiting rules. None were inferred | Dashboard only. See the Phase 5 WAF check below |
| Cleanup Worker | Cron expression verified. Run logs unread | Version `f72517a1-bd70-4698-9f50-d4b17a662ec5` has a `scheduled` handler. The version JSON has no cron field. The live schedules read on 23 October 2026 returned `triggers.crons` `0 * * * *`. Cleanup was not invoked | Do not press Run. Recent log lines are still unread |
| Live API shape | Verified for two public reads | `GET /api/r2?action=health` returned `provider: Cloudflare R2`, `runtime: workers`, bucket `itransfer-storage`, `configured: true`. `action=tier-limits` returned free 6 GB, 7 days, `paidFeaturesEnabled: false` | This matches the Pages function, not the old `api/r2.js` in commit `4bce02c`. It does not prove every uncommitted line is deployed |
| Deployment label | Verified label, incomplete description of the code | Latest production deployment is environment Production, branch `main`, source `4bce02c`, about 4 days before this audit. Preview deployments exist for branch `phase5-rate-limit-test` | Do not treat that source label as the working tree. Do not deploy this tree |

The lifecycle rule aborts an unfinished multipart upload after 7 days. It does not delete a finished object. Free retention is 168 hours, which is the same nominal length, and Cloudflare does not promise the abort at the exact hour. A multipart upload that is still incomplete at that age can lose its upload id while the database row remains until cleanup. Do not add a second rule that deletes objects at 7 days.

`vercel.json` declares daily crons for `/api/drive?action=cleanup` and `/api/r2?action=cleanup`. Those entries belong to a Vercel config. They were not observed running. The Cloudflare cleanup path is the Worker above. `api/lib/security.js` uses the word cleanup for an in-memory rate-limit map. That is not R2 deletion.

## Phase 5 read-only checks

These checks were repeated on 23 October 2026. No binding, schedule, DNS record, secret, or WAF rule was changed. Cleanup was not called.

### Rate-limit binding

`functions/lib/rateLimit.js` reads `env.RATE_LIMITER` and POSTs `{ bucket, key }` to `https://itransfer-rate-limit.internal/`. A missing binding, a throw, a non-200 response, or JSON whose `allowed` field is not `true` is unavailable. Callers in `functions/lib/r2Engine.js` and `functions/api/send-email.js` fail closed on that result. The working-tree binding name is `RATE_LIMITER`. The target service name in `wrangler.jsonc` is `itransfer-rate-limit`.

The Worker `itransfer-rate-limit` is deployed. Project `deployment_configs` for Production and Preview both bind `RATE_LIMITER` to `itransfer-rate-limit`. The serving deployment `aa8a4342` does not include that binding in its list object. The Pages service-binding documentation, updated 25 June 2026, says to redeploy before the binding takes effect.

Human check, without changing anything:

1. Open the Cloudflare dashboard for account `iprudhvidasari@gmail.com`.
2. Go to Workers & Pages → `itransfer-app` → Settings → Bindings.
3. Open the Production environment. Record whether a service binding named `RATE_LIMITER` points at the Worker `itransfer-rate-limit`. Record every other binding name. Do not open secret values.
4. Switch to the Preview environment and record the same line. Preview deployments exist for branch `phase5-rate-limit-test`. Preview is a separate binding list.
5. Also record the Production and Preview plain variable names. The working tree expects `CLOUDFLARE_R2_BUCKET` and `APP_URL`. Write down whether `APP_URL` is `https://itransfer.iprudhvi.in`. Do not copy secret values.

Project Production and Preview both have `RATE_LIMITER` → `itransfer-rate-limit` in `deployment_configs`. The Pages service-binding docs say that binding takes effect on the next deploy. Deployment `aa8a4342` does not include its own copy of the binding, so the Functions serving now are not proven to see `env.RATE_LIMITER`. This phase does not add, remove, or redeploy it.

### Cleanup scheduler

The repo file `wrangler.cleanup.jsonc` declares cron `0 * * * *` and `observability.enabled: true`. The deployed version JSON does not include that cron. The live schedules endpoint, read on 23 October 2026, returned `triggers.crons` of `0 * * * *`. Historical trigger runs were not read. `wrangler tail` was not started.

Human check, without pressing Run or changing the schedule:

1. Workers & Pages → `itransfer-cleanup-scheduler` → Settings → Triggers.
2. Record the Cron Trigger expression. The expected value is `0 * * * *`. Record the timezone label the page shows, if any.
3. Workers & Pages → `itransfer-cleanup-scheduler` → Observability, or Logs if that is the label on the page.
4. Record the time of the latest scheduled invocation, the HTTP status the Worker received from `https://itransfer.iprudhvi.in/api/r2?action=cleanup`, and whether the log line contains `cleanup_completed`.
5. Also record any exception text and any log that shows the cleanup response was not the message `Expired R2 objects purged`. Do not copy the `CLEANUP_SECRET` header or any token.

### WAF and abuse protection

Edge WAF is UNVERIFIED. Application limits are a different layer.

What is known:

| Layer | Status | Evidence |
| --- | --- | --- |
| Turnstile | NOT CONFIGURED | `wrangler turnstile widget list` returned no widgets on 23 October 2026 |
| Application rate-limit Worker | VERIFIED numbers on the Worker | Bindings listed in the table above |
| Pages call into that Worker | UNVERIFIED | Binding not visible from the CLI |
| In-isolate password map | VERIFIED in the working tree | Still used by `download-url` and by `verify-password` after the shared bucket allows the attempt. `verify-password` now calls `PASSWORD_LIMIT` first |
| Zone WAF custom rules, managed rules, and rate-limiting rules | UNVERIFIED | No Wrangler read command |

`sendtoanyone.com` uses Cloudflare nameservers, so its zone can hold WAF rules. `iprudhvi.in` uses GoDaddy nameservers, so a Cloudflare WAF rule for that zone was not assumed. The canonical host is `itransfer.iprudhvi.in`.

Human check:

1. Cloudflare dashboard → the `sendtoanyone.com` zone → Security → WAF. Record each custom rule and each rate-limiting rule: name, expression, and action. If the lists are empty, write NOT CONFIGURED.
2. If the account zone list has no `iprudhvi.in` zone, write that down. Do not create a zone.
3. Do not enable Turnstile and do not add a threshold. A number in the proposal table later in this file is not an active rule.

The documented public URL remains `https://itransfer.iprudhvi.in`. `sendtoanyone.com` answers on the public internet, and its current HTML canonical tag still points at `itransfer.iprudhvi.in`. That hostname is not treated here as a replacement canonical domain.

The live HTML title on all three hosts below is `iTransfer — Send Large Files Free (5 GB) · Secure Link Sharing`. The working tree uses the name SendToAnyone and a 6 GB transfer cap. The deployed document is not this working tree.

## How to read each row

| Column | Meaning |
| --- | --- |
| Purpose | Why the item matters |
| Verification | How to check it without guessing |
| Expected | What correct looks like |
| Status | Verified in the repo, verified in public, unverified, or recommendation |
| Risk | What goes wrong if it is wrong or changed blindly |
| Dashboard action | Whether a person must open a dashboard. This phase takes none |

## 1. Pages project and domain

| Item | Purpose | Verification | Expected | Status | Risk | Dashboard action |
| --- | --- | --- | --- | --- | --- | --- |
| Project name | Production host for the app | `wrangler.jsonc` field `name` | `itransfer-app` | Verified in the repo | Renaming the project changes the `pages.dev` hostname | No |
| Build output | Pages publishes the Vite build | `pages_build_output_dir` | `dist` | Verified in the repo | A wrong directory publishes an empty or old site | No |
| Compatibility | Runtime for Pages Functions | `compatibility_date` and `compatibility_flags` | `2026-08-20`, `nodejs_compat` | Verified in the repo | Removing `nodejs_compat` can break functions that use Node APIs | No |
| Production URL | Canonical public site | `APP_URL` in `wrangler.jsonc`, `SeoHead` canonicals, and a public request | `https://itransfer.iprudhvi.in` | Verified in the repo and in public HTML | Changing canonicals before every link, mail template, and DNS record is updated splits the site | No |
| `pages.dev` hostname | Pages default hostname | Public HTTPS | `https://itransfer-app.pages.dev` returns HTTP 200 and the same title and canonical as the custom domain | Verified in public | This hostname stays live even if the custom domain changes. It is not a secret preview URL | Confirm in Pages whether production branch deployments and preview deployments are separated |
| `sendtoanyone.com` | Extra public hostname | Public HTTPS, certificate, DNS, and Pages project list | HTTP redirects to HTTPS. HTTPS returns the same HTML size and title as the Pages hostname. Canonical is still `https://itransfer.iprudhvi.in/`. Certificate CN is `sendtoanyone.com`, Google Trust Services, notAfter 19 January 2027. SAN does not include `www`. Pages project list includes this domain on `itransfer-app` | Verified | Treating it as the canonical domain would disagree with `APP_URL`, mail links, and the canonical tag. `www.sendtoanyone.com` does not resolve | Do not remove or redirect it in this phase |
| Apex `iprudhvi.in` | Separate site | Public HTTPS and DNS | HTTPS returns 308 to `https://www.iprudhvi.in/`. Response server is Vercel, not this Pages app | Verified in public | Pointing the apex at Pages would replace the existing site | Do not change this record for SendToAnyone |
| `www.iprudhvi.in` | Separate site | Public HTTPS and DNS | CNAME to a `vercel-dns` host. HTTP 200 from Vercel and Next.js | Verified in public | Same as the apex | Do not change this record for SendToAnyone |

## 2. Environments, bindings, and secrets

`wrangler.jsonc` has one `vars` block and one service binding. It does not declare preview-only variables, encrypted secrets, or an R2 bucket binding. The Worker reads R2 through S3-compatible credentials, not through an R2 binding.

| Name | Kind in this repo | Purpose | Expected handling | Status | Risk | Dashboard action |
| --- | --- | --- | --- | --- | --- | --- |
| `CLOUDFLARE_R2_BUCKET` | Plain var, value `itransfer-storage` | Bucket name | Ordinary variable. Not a secret | Verified in the repo | A preview deployment that inherits this name writes to the production bucket if its keys are also production keys | Confirm production and preview use different buckets or that preview is not allowed to sign production uploads |
| `APP_URL` | Plain var, value `https://itransfer.iprudhvi.in` | Origin used in transfer mail links | Ordinary variable. Must stay the canonical HTTPS origin | Verified in the repo | A preview value of another origin puts that origin into mailed links | Confirm the production value. Do not point it at `sendtoanyone.com` until that name is the chosen canonical |
| `RATE_LIMITER` | Service binding to `itransfer-rate-limit` | Shared rate-limit Worker | Binding, not a secret | VERIFIED in the repo. UNVERIFIED on Production and on Preview | If the binding is missing, the actions that call `checkSharedLimit` fail closed, including part URLs in this working tree | Workers & Pages → `itransfer-app` → Settings → Bindings. Check Production and Preview separately. Do not change the row |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Read by `r2Engine.js`, not in `wrangler.jsonc` | R2 S3 account | Encrypted secret | Name verified in code. Production presence unverified | A plain variable is readable in the Pages UI and in deployment logs | Confirm it is a secret |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Same | R2 access key id | Encrypted secret | Same | Same | Confirm it is a secret, scoped to `itransfer-storage` only |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Same | R2 secret key | Encrypted secret | Same | Leak allows signed upload and delete | Confirm it is a secret. Rotation steps are in `production-operations.md` |
| `CLOUDFLARE_R2_ENDPOINT` | Optional override | Non-Cloudflare S3 endpoint | Must be empty in production. Isolated mode sets `http://127.0.0.1:9000` | Verified in code | A production endpoint pointing at MinIO or another account stores files outside R2 | Confirm production does not set it |
| `CLOUDFLARE_R2_REGION` | Optional override | Signing region | Empty in production uses the Cloudflare R2 default. Isolated mode uses `us-east-1` | Verified in code | A wrong region breaks signatures | Confirm production does not set the local region |
| `SUPABASE_URL` | Read by the Worker | Database and Auth API | Ordinary variable is acceptable. It is not a secret | Name verified. Production value unverified | Preview pointed at production Supabase writes production rows | Confirm production and preview are separate |
| `SUPABASE_SERVICE_ROLE_KEY` | Read by the Worker | Bypasses RLS for reservations and cleanup | Encrypted secret. Never a `VITE_` variable | Name verified. Isolated mode rejects this key in `VITE_` names | A client bundle or preview log that contains it can write every row | Confirm it is a production secret only |
| `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` | Read by the Worker. The code also has a non-isolated fallback | Browser and JWT introspection | Publishable. May be a variable. Must not be the service-role key | Name verified | Using the service-role key here exposes full database access | Confirm the value is the publishable key |
| `CLEANUP_SECRET` | Read by cleanup, `delete-object`, and `ensure-cors` | Operator header `x-cleanup-secret` | Encrypted secret. Isolated mode allows only a `local-` prefix | Name verified. Production presence unverified | Empty secret makes cleanup return `503`. A leaked secret can delete objects | Confirm it is set only in production and in the caller that runs cleanup |
| `RESEND_API_KEY` | Read by `functions/api/send-email.js` | Sends mail | Encrypted secret. Isolated mode rejects it | Name verified. Production presence unverified | Missing key returns a client mailto fallback and sends nothing. A leaked key can send mail | Confirm it is a production secret |
| `EMAIL_FROM_ADDRESS` | Override of `SendToAnyone <send@sendtoanyone.com>` | From header | Encrypted on Pages. The code reads it from the environment | Name present in the production secret list. Value not read, so the live From address is UNVERIFIED | The code default applies only when this value is empty. It is not empty | Compare the domain with Resend without copying the value |
| `EMAIL_REPLY_TO` | Used when the sender did not type an email | Reply-To | Ordinary variable | Name verified. Value unverified | A wrong address receives recipient replies | Confirm or leave unset |
| `UPLOADS_PAUSED` | Not in `wrangler.jsonc` | Emergency pause | Ordinary variable. `1` or `true` pauses new upload authorization. Unset, empty, or `0` does not | Verified in code | Setting it stops new upload URLs. It does not revoke URLs already signed for 900 seconds | Do not set it as part of this review |
| `DODO_API_KEY`, `DODO_ENV`, `DODO_PRODUCT_MONTHLY`, `DODO_PRODUCT_YEARLY` | Read by `functions/api/payment.js` | Payments | API key must be a secret. Paid plans are disabled in storage policy | Names verified. Whether production sets them is unverified | A live payment key on a paused product can still create checkouts if the route is called | Confirm the key is a secret and that checkout is not publicly usable until entitlements exist |
| `ITRANSFER_ISOLATED` | Vite-only guard | Local API | Must be unset on Pages | Verified in code | If set to `1` on Pages, the Worker fail-closes local configuration | Confirm it is absent in production and preview |

Plain variables and secrets are separate in Pages. Production and preview each have their own values. This repo does not show the preview set.

Rotation, when later approved: create the new secret, save it on the Pages project, confirm one successful call, then revoke the old credential. Do not revoke first. Do not put the new value in git, in `env/isolated`, or in a `VITE_` name.

## 3. HTTPS, certificates, and redirects

There is no `_redirects` file in the repository. `public/_headers` sets HSTS `max-age=31536000; includeSubDomains; preload` on `/*`.

| Item | Purpose | Verification | Expected | Status | Risk | Dashboard action |
| --- | --- | --- | --- | --- | --- | --- |
| HTTP to HTTPS on the custom domain | Avoid mixed content | `curl -I http://itransfer.iprudhvi.in/` | `301` to `https://itransfer.iprudhvi.in/` | Verified in public | An extra redirect to another host can loop | No change |
| HTTPS custom domain | Serve the app | `curl -I https://itransfer.iprudhvi.in/` | `200`, `server: cloudflare`, HSTS and the headers from `_headers` | Verified in public | — | No change |
| Certificate | Browser trust | Public certificate | CN `itransfer.iprudhvi.in`, issuer Google Trust Services `WE1`, notAfter 15 January 2027, SAN is only that name | Verified in public | A dashboard SSL mode change is not visible from the repo. The zone for `iprudhvi.in` is not on Cloudflare nameservers, so Cloudflare SSL mode for that zone is not the control. The certificate is on the Pages hostname | In Pages, confirm the custom domain shows active and the certificate is not expiring unnoticed |
| `pages.dev` certificate | Default host | Public certificate | Let's Encrypt, SAN `itransfer-app.pages.dev` and `*.itransfer-app.pages.dev`, notAfter 15 January 2027 | Verified in public | — | No change |
| `sendtoanyone.com` certificate | Extra host | Public certificate | Google Trust Services, CN and SAN `sendtoanyone.com` only, notAfter 19 January 2027. HTTP `301` to `https://sendtoanyone.com/` | Verified in public | HSTS with `includeSubDomains` on this response applies to names under `sendtoanyone.com`. `www` does not exist today. Adding `www` later without HTTPS will fail in browsers that have seen HSTS | Do not add `www` until it has a certificate. Do not submit either name to the HSTS preload list from this review |
| Redirect loop | Keep one canonical hop | One request with redirects disabled | Each HTTP URL above makes one hop to its own HTTPS URL. Apex `iprudhvi.in` hops to `www.iprudhvi.in`, which is the other site | Verified in public | A new rule that sends `sendtoanyone.com` to `itransfer.iprudhvi.in` and another rule that sends it back will loop | Any new redirect needs a written before-and-after and a single-hop test |
| Preview URLs | Keep drafts off the canonical domain | Pages deployment list | Preview deployments use `*.pages.dev` and must not be attached to `itransfer.iprudhvi.in` | Unverified | A preview branch attached to the custom domain replaces production | Confirm in the Pages domains screen |

## 4. DNS checklist

Inspect records before any edit. Cloudflare’s DNS, proxy, and certificate docs are the reference for zones hosted there: [manage DNS records](https://developers.cloudflare.com/dns/manage-dns-records/), [proxy status](https://developers.cloudflare.com/dns/proxy-status/), [visitor TLS](https://developers.cloudflare.com/ssl/edge-certificates/encrypt-visitor-traffic/).

`iprudhvi.in` nameservers are `ns41.domaincontrol.com` and `ns42.domaincontrol.com`. That zone is not delegated to Cloudflare. Edit it only in the DNS host that currently serves it, and only after copying the existing record.

`sendtoanyone.com` nameservers are `addyson.ns.cloudflare.com` and `rocco.ns.cloudflare.com`. Its DNS is on Cloudflare. Proxy status for its apex is not a CNAME in the public answer. Public A and AAAA are Cloudflare addresses (`104.21.4.248`, `172.67.132.167`, and `2606:4700:3034::` addresses). That is consistent with an orange-cloud proxied record. The dashboard is still required to see the record type and target.

| Record | Observed on 23 October 2026 | Purpose | Do not replace it with | Status | Risk | Dashboard action |
| --- | --- | --- | --- | --- | --- | --- |
| `itransfer.iprudhvi.in` | CNAME `itransfer-app.pages.dev` | Sends the app hostname to Pages | An A record, a Vercel target, or a different project | Verified in public DNS | Changing the target takes the app offline or points it at the wrong project | Record the current target, then change only with approval |
| `iprudhvi.in` | A `216.198.79.1` and `76.76.21.21` | Apex of the other site, which redirects to `www` | A Pages CNAME | Verified in public DNS | Replacing these removes the current apex site | No SendToAnyone change |
| `www.iprudhvi.in` | CNAME `e51a5be4bbaead43.vercel-dns-017.com` | Portfolio site | A Pages target | Verified in public DNS | Same | No SendToAnyone change |
| `iprudhvi.in` MX | `10 mx01.mail.icloud.com` and `10 mx02.mail.icloud.com` | Receives mail at iCloud | Resend or any other MX | Verified in public DNS | Replacing MX stops inbound mail for this domain | No change for transfer mail |
| `iprudhvi.in` SPF | TXT `v=spf1 include:icloud.com ~all` | Authorizes iCloud to send for this domain | A Resend include pasted over this record | Verified in public DNS | A second SPF TXT is invalid. Editing this one can break existing iCloud mail | Do not add Resend to this domain in this phase |
| `iprudhvi.in` DMARC | TXT on `_dmarc.iprudhvi.in`: `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | Quarantine policy for the existing domain | `p=none` or a deleted record | Verified in public DNS | Weakening it changes mail policy for a domain this app does not send from | No change |
| `iprudhvi.in` other TXT | A `google-site-verification` TXT and an `apple-domain` TXT exist | Existing product verifications | Deletion | Presence verified. Token text is not copied here | Deleting them drops those verifications | No change |
| `sendtoanyone.com` address records | Cloudflare A and AAAA, no public CNAME | Current website on that name | A new target chosen without reading the proxied record | Addresses verified. Dashboard target unverified | Replacing the proxied target can disconnect the hostname that already serves the app HTML | Open the Cloudflare DNS row and write down type, target, and proxy status before any edit |
| `www.sendtoanyone.com` | No public answer | No www host | An uncertified www record | Verified in public DNS | HSTS `includeSubDomains` is already on the apex response | Do not add www until certificate coverage is planned |
| `sendtoanyone.com` MX | No MX answer | This domain is not publicly set up to receive mail | An invented mail host | Verified in public DNS | Adding MX is a receiving-mail decision, separate from Resend sending | No change until receiving mail is an approved product |
| `sendtoanyone.com` SPF | No SPF TXT. One `google-site-verification` TXT exists | Website verification. Not mail authorization | A guessed SPF value | Absence of SPF verified. Verification token text is not copied here | A guessed SPF will fail or conflict | Copy SPF from the Resend dashboard only after that domain is the chosen sender. Do not delete the Google TXT |
| `sendtoanyone.com` DMARC | TXT on `_dmarc.sendtoanyone.com`: `v=DMARC1; p=none;` | Monitoring policy, already present | `p=quarantine` or `p=reject` | Verified in public DNS | A stricter policy before reports are read will drop legitimate mail | Leave `p=none` until the email checklist says otherwise |
| `resend._domainkey.sendtoanyone.com` | A TXT record exists | Public DKIM material for the Resend selector | A second key at the same name, or deletion | Presence verified. The key text is not copied here. Resend’s verified state was not opened | The record can exist while Resend still shows the domain as pending, or while the app sends from a different address | Compare the dashboard value with DNS. Do not treat this document as the key source |
| `resend._domainkey.iprudhvi.in` | No TXT or CNAME answer | No Resend DKIM on the iCloud domain | — | Verified in public DNS | — | Do not add it in this phase |

Web hosting records and mail authentication records are different. The CNAME for `itransfer.iprudhvi.in` serves the website. MX, SPF, DKIM, and DMARC affect mail. Changing one does not configure the other.

## 5. WAF and abuse prevention

No WAF rule is defined in this repository, and Wrangler cannot list WAF rules. Turnstile has no widgets on this account. The Worker `itransfer-rate-limit` is deployed with these bindings: upload 30 per 60 seconds, parts 120, download 120, password 8, claim 20, delete 20, request 10, and email 5. Those numbers match `functions/lib/localIsolation.js`. They are the Worker’s own limits. The live Pages binding that would call that Worker is UNVERIFIED. The working tree calls the password bucket from `verify-password`, and from a password-protected `download-url`, before it compares a hash. In the working tree, a missing Pages binding fails closed for the actions that call `checkSharedLimit`, including `verify-password`, `get-part-url`, and `get-part-urls`. That working tree is not the deployed production document.

Application limits that do exist:

| Path | Application behavior | Shared across isolates |
| --- | --- | --- |
| `open-transfer`, `get-put-url`, `initiate-upload` | `RATE_LIMITER` bucket `upload`. Unavailable or blocked fails closed | Only if the binding is healthy |
| `get-part-url`, `get-part-urls` | Bucket `parts`. An explicit block is 429. If the limiter is unavailable, the working tree returns 503 and does not sign | Only if the binding is healthy |
| `download-url`, `share-meta`, `request-meta` | Bucket `download` | Yes, when the binding is healthy |
| `verify-password` and password-protected `download-url` | Bucket `password`, after a SHA-256 of the share id and client IP. Unavailable or blocked fails closed before the hash is compared. `download-url` still spends the `download` bucket first. The in-isolate map still counts wrong attempts afterward | Yes, when the binding is healthy |
| `claim`, `delete-own`, `create-request` | Buckets `claim`, `delete`, `request` | Yes, when the binding is healthy |
| `POST /api/send-email` | Bucket `email`. Blocked or unavailable returns HTTP 200 and does not call Resend | Yes, when the binding is healthy |
| `POST /api/geo` | No application rate limit. The response includes `cf-connecting-ip` | No |

Edge rules below are proposals. They are not active. Each one depends on the plan supporting [WAF rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/) and on a count of real traffic so the threshold sits above legitimate use and below abuse. A false positive on `get-put-url` or `get-part-urls` stops uploads. A false positive on `download-url` stops recipients.

| Proposal | Scope | Why | Test before enabling | Dependency |
| --- | --- | --- | --- | --- |
| Managed ruleset | Zone or Pages hostname for `itransfer.iprudhvi.in` and, if it is the same zone, `sendtoanyone.com` | Blocks known exploit probes in front of the app | Log-only first. Read matches for 24 hours. Confirm `POST /api/r2` uploads and `POST /api/send-email` are not matched | Plan includes the managed ruleset. Do not enable block mode in this phase |
| Upload initialization | `POST` with query `action=open-transfer`, `get-put-url`, or `initiate-upload` | Extra edge limit in front of the application bucket | From one network, a normal transfer still succeeds. A burst returns a challenge or block only after the chosen count. Direct-to-R2 PUTs are not on this hostname, so this rule does not see them | The Worker upload binding is 30 requests per 60 seconds. Recent request volume was not read. Do not copy 30 into a WAF rule until that volume is known |
| Password attempts | `POST` `action=verify-password` and `download-url` | Both use the shared password bucket when `RATE_LIMITER` is bound. Production has no binding, so that path is not active there. The in-isolate failure map still runs after an allow | Wrong passwords eventually get a challenge. One correct password still downloads | Do not copy 8 into a WAF rule until request volume is known. Do not deploy the new password path before the Pages binding exists |
| File-request creation | `POST` `action=create-request` | Authenticated, but still a public route | A signed-in user can create one request. A burst does not | Application already limits the `request` bucket when the Worker is healthy |
| Email | `POST /api/send-email` | Stops a client from asking the app to send many messages | One real transfer email still returns the application’s accepted or fallback JSON. Resend is not called for the blocked ones | Application already holds mail when its limiter blocks. Edge rule is additional |
| Turnstile | Homepage send form and password form, if added later | Bot cost on public writes | Widget loads, a real person passes, the server rejects a missing token | No widgets exist. Adding one is an application change. Do not create one in this phase |

Bypass check for any future rule: a request that does not match the expression must behave as today. A request that matches must be visible in security events. Direct uploads go to the R2 host in the signed URL, so a rule on `itransfer.iprudhvi.in` does not rate-limit the PUT body.

Incident response, when a rule is later enabled: switch that rule to log, confirm uploads and downloads, then adjust the expression. Do not delete the application limiter because an edge rule exists. `UPLOADS_PAUSED` remains the application stop for new upload authorization.

Monitoring that this repo does not configure: Pages function logs, Worker error rate, WAF events, and R2 metrics. Public responses include a Cloudflare `report-to` NEL group with `success_fraction` 0, so that header is not a success log. Web analytics were not found in `wrangler.jsonc` and were not opened in the dashboard.

## 6. R2 security and lifecycle

References: [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/), [object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

The application model is a private bucket. The browser receives a presigned URL for one method and one object. `ensure-cors` is an operator action protected by `CLEANUP_SECRET`. It writes one rule: origin `*`, methods GET, PUT, HEAD, and POST, header `*`, exposed `ETag` and `Content-Length`. That allows a browser on the public site to upload with a signature. It does not make an unsigned object readable. Whether this rule is currently installed on `itransfer-storage` was not opened.

| Item | Purpose | Verification | Expected | Status | Risk | Dashboard action |
| --- | --- | --- | --- | --- | --- | --- |
| Bucket name | One production bucket | `wrangler.jsonc`, health response, and `wrangler r2 bucket dev-url get` | `itransfer-storage`. The r2.dev public URL is disabled. Isolated tests use `itransfer-local` | Verified | Enabling the r2.dev URL would expose objects without a signature | Do not enable public access |
| Credentials | Least privilege | R2 API token screen | Token can read and write only `itransfer-storage` | Unverified | An account-wide token can read other buckets | Confirm scope. Do not create a new token in this phase |
| Upload signature | Limit a leaked URL | `STORAGE_POLICY.uploadUrlSeconds` | 900 seconds, PUT for that key | Verified in code | The URL cannot be revoked. Pause and reservation release do not stop it | No change |
| Download signature | Limit a leaked URL | `downloadUrlSeconds` | 900 seconds, GET for that key | Verified in code | Same | No change |
| Object key | Keep the client out of the path | `r2Engine.js` key format | `transfers/{timestamp}-{random}/{sanitized file name}` | Verified in code | A lifecycle rule that assumes a different prefix will miss objects or delete the wrong ones | No change |
| Ownership | Server-side | Delete token or `user_id` | Part URLs and completion require the pending row, the same multipart id, and the delete token | Verified in code and in the security audit | — | No change |
| Size | Stop a declared or actual over-size object | Reservation and `activateObject` | Declared size over `6_000_000_000` is refused. After upload, `Content-Length` must match the row or the object is deleted and the row rejected | Verified in code. Production reservation function is not applied | Deploying the Worker without the function fails new uploads | Do not deploy from this phase |
| Expiry | Free retention | `retentionHours` | Values outside 1–168 hours become 168 | Verified in code | A lifecycle rule is not this control | Do not add a 7-day object delete |
| Abandoned single PUT | Release quota | Cleanup | Pending row, no multipart id, older than 900 seconds plus 60 seconds. Row becomes `released` only after delete succeeds or returns 404 | Verified in code | If the live cron is absent, the row stays occupied until `expires_at` | The scheduler Worker is deployed. The cron expression is UNVERIFIED. Do not invoke cleanup |
| Incomplete multipart | Abort sessions | Cleanup and delete | Abort runs when the row is expired or deleted and still has an upload id. A pending multipart row with a future `expires_at` is kept | Verified in code | An R2 incomplete-upload rule that deletes parts earlier can break an in-progress transfer the database still considers pending | Do not add an incomplete-upload lifecycle shorter than 168 hours |
| Failed delete | Keep the record honest | Cleanup | Object delete failure sets `pending_delete` and does not mark the transfer expired | Verified in code | Those rows still occupy the 6 GB share sum | Retry cleanup. Do not mark them expired by hand |
| Orphan scan | Objects whose rows are already expired, rejected, or released | Cleanup list | Only keys older than 90 days, at most five pages of 200 keys | Verified in code | A 7-day lifecycle would delete objects the application can still serve | No lifecycle rule in this phase |

Do not add a lifecycle rule that deletes objects 7 days after creation. Free retention is 168 hours in application logic, measured from `expires_at`, not from an R2 lifecycle clock. Lifecycle deletion is not exact to the hour. The key prefix encodes creation time, and a later retention change, a clock difference, or an unfinished multipart upload would make a seven-day delete remove objects the database still treats as occupied. The application orphan scan uses 90 days and only deletes when the row is already expired, rejected, released, or missing. A lifecycle backstop, if one is approved later, has to be longer than every supported retention path and has to be tested against a real key. That rule is not approved here.

R2 stored bytes, Class A operations, and Class B operations are dashboard metrics. They were not read. A billing alert does not stop uploads.

## 7. Analytics, logs, and what remains unverified

| Item | Status | Where to look | Do not assume |
| --- | --- | --- | --- |
| Pages encrypted secret names | Verified for production. Values not read | `wrangler pages secret list` | That preview has the same names. Preview was not listed |
| Plain variables and `RATE_LIMITER` on the Pages project | UNVERIFIED | Workers & Pages → `itransfer-app` → Settings → Bindings, Production and Preview | That the current `wrangler.jsonc` binding is what production is using |
| Custom domains | VERIFIED attached | `wrangler pages project list` and public certificates | That `sendtoanyone.com` is the canonical URL |
| WAF | UNVERIFIED | `sendtoanyone.com` zone → Security → WAF. Record empty lists as NOT CONFIGURED | That a managed ruleset is on |
| Turnstile | NOT CONFIGURED | `wrangler turnstile widget list` on 23 October 2026 | — |
| R2 public URL, CORS, and lifecycle | VERIFIED | The three `wrangler r2 bucket` read commands | That the multipart abort rule deletes finished objects |
| Worker rate-limit numbers | VERIFIED on `itransfer-rate-limit` | `wrangler versions view` for that Worker | That Production Pages has `RATE_LIMITER`. The working tree calls the password bucket, and that call is inactive until the binding exists |
| Workers Logs and Web Analytics | Source is ready. Live collection UNVERIFIED | `observability.enabled` is set on the Pages, rate-limit, cleanup, and preview-limiter configs. The beacon is one module script in `index.html`. Live `https://itransfer.iprudhvi.in/` on 23 October 2026 did not contain it. `rum/site_info/list` and `alerting/v3/policies` both returned HTTP 403 error `10000`. The steps that remain are in `production-operations.md` | That a local Wrangler flag is already logging, or that `url_issued` is a completed download, or that `provider_accepted` is mailbox delivery |
| Logpush, function alerts, billing alerts | UNVERIFIED | Observability and billing screens | That an alert stops usage |
| Cleanup cron expression and failure logs | UNVERIFIED | Workers & Pages → `itransfer-cleanup-scheduler` → Settings → Triggers, then Observability | That `0 * * * *` in the repo file is the live trigger |

No dashboard action is required to finish this document. Every change in the tables above needs the approval steps in `production-operations.md`.
