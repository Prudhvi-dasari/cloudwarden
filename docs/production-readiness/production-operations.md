# SendToAnyone production operations

This is the operating guide for the checks in the Cloudflare and email documents. It does not authorize a deploy, a migration, a DNS edit, a secret rotation, or a billing change.

Read-only commands on 23 October 2026 used Wrangler 4.151.1, already logged in as `iprudhvidasari@gmail.com`. They did not change DNS, secrets, the bucket, lifecycle rules, or mail. `npx wrangler whoami` was run twice. The sandbox attempt could not reach Cloudflare. The retry outside the sandbox succeeded. Then these read commands succeeded: `r2 bucket dev-url get`, `r2 bucket lifecycle list`, `r2 bucket cors list`, `pages project list`, `pages secret list`, `pages deployment list`, `deployments list` and `deployments status` for `itransfer-cleanup-scheduler`, `deployments list` and `versions view` for the cleanup and rate-limit Workers, and `turnstile widget list`. Public `GET` requests read `action=health` and `action=tier-limits`. `OPTIONS /api/send-email` was read. Cleanup was not called. No email was sent.

The public site is `https://itransfer.iprudhvi.in`. The Pages project is `itransfer-app`. The R2 bucket name is `itransfer-storage`. The product name in the working tree is SendToAnyone. The HTML currently served on the public hosts still titles itself iTransfer and says 5 GB. That deployed document is older than this working tree.

Phase 2 ended `PASS WITH BLOCKERS`. Those blockers are still open.

## What is already enforced

| Control | What it does | What it does not do |
| --- | --- | --- |
| Share reservation | When `reserve_transfer_file` exists, one share stays at or under `6_000_000_000` bytes | It is not an account cap. The whole-platform cap is separate. This repository targets `1000000000000` (1 TB). Production still enforces `300000000000` until `supabase/migrations/20261023093633_raise_platform_storage_cap.sql` is applied |
| Retention | The application stores free transfers for at most 168 hours | An R2 lifecycle rule is not this timer |
| `UPLOADS_PAUSED` | `1` or `true` blocks new transfers, PUT URLs, and part URLs | It does not revoke a URL already signed. Those last 900 seconds. Completion, download, delete, and cleanup stay available. It is not set in `wrangler.jsonc` |
| Email hold | `/api/send-email` does not call Resend when the shared limiter blocks or is unavailable | HTTP 200 in that case is not a sent message |
| Cleanup secret | `cleanup`, `delete-object`, and `ensure-cors` reject a missing or wrong `x-cleanup-secret` | Production Pages has an encrypted `CLEANUP_SECRET`. The cleanup Worker version also names that secret. The values were not read |

`STORAGE_POLICY.quotaBytes` is 7 GB and nothing calls `canReserve`. Download counts are incremented with a read followed by a write, so overlapping downloads can pass the same count. A Cloudflare billing email does not stop either behavior.

## Where to look

| Question | Place | This review |
| --- | --- | --- |
| Is the custom domain serving HTTPS? | Public request to `https://itransfer.iprudhvi.in` | Yes, on 23 October 2026. Certificate notAfter 15 January 2027 |
| Is `sendtoanyone.com` the canonical site? | Canonical tag and `APP_URL` | No. The hostname answers, and the canonical tag is still `https://itransfer.iprudhvi.in/` |
| Is the apex `iprudhvi.in` this app? | Public response | No. It redirects to `www.iprudhvi.in`, which is a Vercel site |
| How much R2 storage is used? | R2 metrics for `itransfer-storage` | Not opened |
| Are Pages functions erroring? | Pages function logs and the `itransfer-rate-limit` Worker logs | Not opened |
| Is Supabase near its limits? | Supabase usage for project `tranferfiles` | Not opened. Do not inspect unrelated schemas |
| How many emails were accepted? | Resend logs | Not opened. Acceptance there is still not mailbox delivery |
| Is there a budget alert? | Cloudflare billing notifications | Not opened. An alert is not a cap |
| Is cleanup running? | Worker `itransfer-cleanup-scheduler` and its logs | The Worker is deployed and its current version has a `scheduled` handler. The repo cron is `0 * * * *`. The live cron expression was not in the version view. Logs were not tailed, so a failed run was not observed |

## Changes that need approval

Do not perform these while using this document. Each one needs a written yes that names the record or secret and the rollback.

| Change | Why it is not routine | Approval includes |
| --- | --- | --- |
| Pages deploy of this working tree | New uploads call `reserve_transfer_file`. Production does not have that function. The Worker alone returns `RECORD_FAILED` | Apply the migration and deploy the Worker in one planned window, or deploy neither |
| `supabase db push` or a remote migration | The reservation function changes write behavior | A backup and a rollback statement. No `db reset` |
| DNS for `itransfer.iprudhvi.in` | It is the live CNAME to `itransfer-app.pages.dev` | The current target copied down first |
| DNS for `iprudhvi.in` or `www` | Those names are the other site and iCloud mail | A reason that is not SendToAnyone hosting |
| DNS for `sendtoanyone.com` | The name already serves the current HTML through Cloudflare | The current proxied target copied from the dashboard |
| SPF, DKIM, or DMARC | `iprudhvi.in` is iCloud. `sendtoanyone.com` already has DMARC `p=none` and a Resend DKIM TXT | Values pasted from Resend, not from memory |
| `EMAIL_FROM_ADDRESS` or `APP_URL` | They change who mail claims to be and where links point | Verified domain and a mailbox test |
| WAF, rate limit, or Turnstile | Can block uploads and downloads | A log-only period and a threshold taken from real traffic |
| R2 lifecycle | Can delete objects the database still serves | Proof the age is longer than every retention path. A 7-day delete is not that proof |
| Secret rotation | Revoking the old key first causes an outage | New secret saved, one successful call, then revoke |
| `UPLOADS_PAUSED=1` | Stops new upload authorization | A start time and the person who will unset it |
| Billing plan or budget | Can change what the account is allowed to do | The current plan name written down first |

## Rollback

| If this happens | Safe rollback | Do not |
| --- | --- | --- |
| A Pages deploy breaks uploads | In the Pages deployments list, roll back to the previous production deployment. Confirm `https://itransfer.iprudhvi.in` returns the previous HTML | Do not `db reset`. Do not delete the R2 bucket. Do not remove the custom domain |
| The new Worker was deployed before the reservation function | Roll the Pages deployment back. Leave the database as it is if the function was not applied. If the function was applied and the old Worker is restored, confirm the old Worker does not require the function before calling the new one a failure | Do not drop the function until the running Worker is known |
| `UPLOADS_PAUSED` was set | Set the variable to `0` or remove it. Wait for the next request. URLs signed during the previous 900 seconds still work | Do not delete pending rows to “clear” the pause. They remain occupied until cleanup or expiry |
| A DNS edit breaks the site | Restore the record that was copied before the edit. For `itransfer.iprudhvi.in`, that public value on 23 October 2026 was CNAME `itransfer-app.pages.dev` | Do not also change the apex or the iCloud MX while restoring it |
| A mail record breaks iCloud | Restore MX `mx01.mail.icloud.com` and `mx02.mail.icloud.com`, SPF `v=spf1 include:icloud.com ~all`, and the existing DMARC TXT | Do not “fix” it by sending transfer mail from `iprudhvi.in` |
| An R2 lifecycle deletes live objects | Remove the lifecycle rule. Application rows may already say the file is active while the object is gone. Those transfers need a support decision per share | Do not run a bucket-wide delete to make the database match |
| A secret was rotated badly | Put the previous secret back if it has not been revoked. If it was revoked, create a new key and save it. Confirm health, one upload, and one download | Do not paste the secret into git or into `env/isolated` |
| Email sends the wrong link | Set `APP_URL` back to `https://itransfer.iprudhvi.in` and redeploy only if the variable is baked into a build. The function reads `APP_URL` from the Pages environment at request time | Do not change canonical tags in the same step unless that was the approved change |

## Cleanup and reservation failures

Cleanup is `GET` or `POST /api/r2?action=cleanup` with header `x-cleanup-secret`. The scheduler Worker sends `GET`. Unset secret returns `503 CLEANUP_UNCONFIGURED`. A wrong header returns `401`.

`itransfer-cleanup-scheduler` is deployed. Its current version has a scheduled handler and a secret named `CLEANUP_SECRET`. `cleanup-scheduler.js` calls `https://itransfer.iprudhvi.in/api/r2?action=cleanup` and throws when the response is not the success JSON. `wrangler.cleanup.jsonc` sets the cron to `0 * * * *` and turns observability on. The version view did not show that cron or the observability flag, and logs were not tailed. A failed run is visible only in the Worker logs if that deployed version still throws and logging is on. Confirm the trigger in the dashboard. Do not invoke production cleanup to test it.

`vercel.json` also names cleanup crons. That file does not schedule the Cloudflare Worker.

A failed object delete does not expire the row. The row becomes `pending_delete` and still counts toward the 6 GB share total. The next cleanup can retry it. Abandoned single-PUT reservations are released only after the object is gone or already missing, and only after the signature lifetime plus 60 seconds.

If new uploads return `RECORD_FAILED`, the running Worker is calling `reserve_transfer_file` and the database does not have it. Roll back the Worker. Do not invent a manual insert path.

On 23 October 2026 the Worker argument list was compared with both unapplied SQL files. The 16 reservation names match, and both download-slot calls send `p_file_id` and `p_share_id`. Disposable Postgres tests of that reconstructed schema passed, including the 100,000-row lock check. Those tests do not prove the functions match the live production schema, and the SQL was not applied.

Production enforces a 300 GB (`300000000000`) platform cap until `supabase/migrations/20261023093633_raise_platform_storage_cap.sql` is applied and verification passes. This repository’s target is 1 TB (`1000000000000`) for the whole platform, not per account. If occupied bytes reach that cap, new reservations return `STORAGE_CAP`. `UPLOADS_PAUSED` remains the operator pause if cost requires it. A billing email is not a cap.

## Operational logs and Web Analytics

The logger and the beacon are in this working tree. They are not live. A public read of `https://itransfer.iprudhvi.in/` on 23 October 2026 returned the older iTransfer title and did not contain the analytics script. `observability.enabled` in a Wrangler file does not change a Worker that is already deployed. Logs and the beacon start only when an approved deploy publishes this tree. Do not create a paid log product, and do not invent a beacon token.

`observability.enabled` is set in `wrangler.jsonc` for Pages Functions, `wrangler.rate-limit.jsonc` for `itransfer-rate-limit`, `wrangler.cleanup.jsonc` for `itransfer-cleanup-scheduler`, and `wrangler.rate-limit.preview.jsonc` for the undeployed preview limiter. The cleanup Worker’s deployed version view still did not show that flag or the cron.

The Pages function and the cleanup scheduler write one JSON line through `functions/lib/opsLog.js`. Each line has `event`, `result`, and, when useful, `category`, `durationMs`, and `count`. The logger drops any other field, and it drops a value that is not a short token. A password, token, signed URL, email address, filename, object key, or request body cannot be stored in that line.

| Event | Result | What it means |
| --- | --- | --- |
| `upload` | `url_issued` | A single-PUT or multipart session was reserved. Part URLs are not logged. |
| `upload` | `activated` or `rejected` | The stored object was checked and marked ready, or the check failed. |
| `reservation` | `rejected` | `STORAGE_CAP`, `TRANSFER_TOO_LARGE`, or `RECORD_FAILED`. |
| `rate_limit` | `blocked` or `unavailable` | The shared limiter refused or could not be read. Allowed checks are not logged. |
| `download_authorization` | `url_issued` | A signed download URL was issued. This is not an R2 GET and not a completed download. |
| `download_authorization` | `denied` | Password, link limit, expiry, or signing failed before a URL was returned. |
| `cleanup` | `completed` or `failed` | One summary for the cleanup run. A failed object delete is a count, not a key. |
| `email` | `provider_accepted` | Resend accepted the message. Category `UNCONFIRMED_DELIVERY` means the mailbox has not confirmed delivery. |
| `email` | `held` or `unconfirmed` | The message was not accepted, or the provider result is incomplete. |
| `request` | `failed` | An unexpected handler error. The message text is not logged. |

Email limiter failures are the `email` event with category `RATE_LIMITED` or `LIMITER_UNAVAILABLE`. They are not logged a second time as `rate_limit`. The cleanup scheduler logs only when its own call fails. A successful cleanup is logged once by the Pages function. The scheduler no longer copies the response body into the error.

The cleanup alert is the exception thrown by `cleanup-scheduler.js` when the secret is missing, the body is not JSON, or the body is not the success JSON. That exception is the signal Cloudflare can notify on. It is not a billing cap, and it does not pause uploads. On 23 October 2026, `GET /accounts/e300e372a7b243402f04adf0900aab6d/alerting/v3/policies` returned HTTP 403 with error `10000` Authentication error. A dashboard notification was not confirmed. The same login’s OAuth scopes include `account:read`, `pages:write`, `workers:write`, and `zone:read`.

`index.html` already contains one Cloudflare Web Analytics module script for the canonical host. It is not imported by the application bundle. `spa` is not set to false. The app uses `BrowserRouter`, so route changes go through the History API. Cloudflare’s Web Analytics SPA documentation, updated 20 August 2026, says the beacon measures those navigations unless `spa` is false. A failed or blocked beacon request stays in that separate module and does not reject the application script. The script was not given a new token.

The Web Analytics API could not confirm or create the site. `GET /accounts/e300e372a7b243402f04adf0900aab6d/rum/site_info/list` returned HTTP 403 with error `10000` Authentication error. Creating a site requires Account Settings Write, and that scope is not on this login. No second site was created.

Remaining activation, at an approved release:

1. Deploy Pages and the two Workers from the configs that set `observability.enabled`. That deploy is also what publishes the beacon. Do not deploy the preview limiter unless that Worker is separately approved.
2. Confirm the cleanup cron `0 * * * *` on the deployed `itransfer-cleanup-scheduler` version.
3. In Workers & Pages → Notifications, add an alert for failed invocations of `itransfer-cleanup-scheduler` if the dashboard does not already list one. This login could not list policies.
4. In Workers Logs, filter for `event`. Use `result` `failed`, `rejected`, `blocked`, and `unavailable`. `download_authorization` with `url_issued` is a link being issued. `email` with `provider_accepted` is provider acceptance.
5. A person with Account Settings Write opens Analytics & logs → Web Analytics and checks that the site token already in `index.html` belongs to `itransfer.iprudhvi.in`. If it does not, replace that one script with the snippet Cloudflare shows. Do not add a second script, and do not enable Logpush.

The priced usage model is in `current-limits.md`. R2 stored bytes remain the cost signal. `UPLOADS_PAUSED` is still the manual stop. Neither a log line nor a billing email is a spending cap.

## Recommendation

The site is publicly up on `https://itransfer.iprudhvi.in`. Health reports the R2 bucket configured. The r2.dev public URL is off. CORS for signed browser uploads is installed. One lifecycle rule aborts incomplete multipart uploads after 7 days and does not delete finished objects.

Do not deploy this working tree and do not change production DNS, WAF, R2 lifecycle, secrets, or mail records from this phase.

## Phase 5 release gates

Read-only closeout on 23 October 2026. Nothing was deployed, applied, or changed. Phase 5 is not closed: the gates below are not all passing.

| Gate | Result | Evidence this pass | Still required |
| --- | --- | --- | --- |
| Production SQL | BLOCKED | `list_migrations` on `tranferfiles` (`giyeepztahdbsejsozog`) ends at `20261018110000`. `reserve_transfer_file`, `claim_download_slot`, and `release_download_slot` are absent. The live `public.transfers` catalog was read on 23 October 2026: the insert columns exist, `recipient_emails` is `text`, `user_id` is `uuid`, and `status` has no check that rejects `pending`. `user_id` references `auth.users` on delete set null. `download_logs` is `jsonb` default `[]` and is not in the insert. RLS is forced. `service_role` bypasses it. Indexes are the primary key, `expires_at`, `request_id`, and `share_id`. The share-and-size index in the first reservation file is not there yet. `supabase/testing/production-sql-preflight.sql` and `supabase/testing/production-sql-verify.sql` are the manual package. Neither script has been run on production | A person runs the preflight in the SQL Editor, reads every FAIL and REVIEW, and only then applies both files in an approved window. The scripts do not prove production compatibility until that run |
| Rate limit on the running Pages deployment | BLOCKED | `wrangler pages download config itransfer-app` on 23 October 2026 wrote the project `deployment_configs` without secret values. Production and Preview both have plain `APP_URL=https://itransfer.iprudhvi.in`, bucket `itransfer-storage`, and service binding `RATE_LIMITER` → `itransfer-rate-limit`. The serving Production deployment remains `aa8a4342-92c4-42de-89dc-b9e7f905849a`. Its deployment object does not include a binding snapshot. The Pages service-binding docs, updated 25 June 2026, say a redeploy is required before a new service binding takes effect | Redeploy only in the approved window below, then read `deployment_configs` again. Do not treat the current project setting as proof that `aa8a4342` already has `env.RATE_LIMITER` |
| Preview isolation | BLOCKED | Source `previewGuard.js` would return 503 before health on `9525312e.itransfer-app.pages.dev`. That URL returned HTTP 200 health, `configured: false`, bucket name `itransfer-storage`. Preview secret list is empty. The guard, a separate database, a separate bucket, and `itransfer-rate-limit-preview` are not in the running Preview deployment | Do not sign in, upload, download, or call cleanup there |
| Cleanup cron | PASS | `wrangler init --from-dash itransfer-cleanup-scheduler` read the live schedules. `triggers.crons` is `0 * * * *`. Cleanup was not invoked. The downloaded files were deleted. Recent run logs were not read | None for the expression |
| Resend verified badge | BLOCKED | No `resend` CLI. `RESEND_API_KEY` was not in the shell environment. The Pages secret value was not read, so the domains API was not called | Open Resend → Domains → `sendtoanyone.com` and record Verified or not |
| Supabase Auth redirects | BLOCKED | `auth.instances` has 0 rows. `auth.custom_oauth_providers` has 0 rows. Site URL and the redirect allow-list are not in the database, and the Supabase API used here has no Auth config call | Authentication → URL Configuration for `giyeepztahdbsejsozog` |
| Cloudflare WAF | BLOCKED | Wrangler 4.151.1 has no WAF read command. The local OAuth token was not extracted for a zone call. `wrangler email sending list` returned Unauthorized, API code 2036. `wrangler email routing list` found no zones with Email Routing | Zone `sendtoanyone.com` → Security → WAF. Record the rules or NOT CONFIGURED |
| Docker live tests | PASS — local isolation closed | On 23 October 2026 listeners were `127.0.0.1:55421` through `127.0.0.1:55424` only. `isolated-live` and `isolated-auth` passed. Later stop and start cycles exited 0. Stop does not call `supabase stop` or prune. Start removes only verified stopped `itransfer-local-stack` containers and does not use `-v`. Prudhvi containers and volumes stayed in place. The stack was left stopped | None for this local check. Do not prune: `supabase_edge_runtime_prudhvi` is exited and a prune would remove it |

### Rollout and rollback runbook

Documentation only. Do not run these steps from this phase. The project is Supabase `tranferfiles` (`giyeepztahdbsejsozog`). The Pages project is `itransfer-app`. The serving Production deployment at the time of this note is `aa8a4342-92c4-42de-89dc-b9e7f905849a`. Record the id again at the start of the window and use that recorded id as the rollback target.

The order is fixed: backup and recovery readiness, then preflight, then the approved migration, then verification, then the compatible Pages deployment, then serving-deployment limiter verification, then smoke tests. Do not start a later step while an earlier step has a FAIL. The 1 TB source check is the exception in step 4. `platform_cap_source` FAIL and `VERIFY_BEHAVIOR_NOT_RUN` are expected until `20261023093633_raise_platform_storage_cap.sql` is applied. That pair is closed only in Raise the platform cap to 1 TB. It is not a reason to undo the 300 GB function or to repeat the Pages deployment.

The free plan is not a backup product. Do not assume point-in-time recovery. Do not dump row contents, and do not delete transfers, the R2 bucket, or the `supabase_*_prudhvi` volumes.

1. Backup and recovery readiness. Write down the migration list and the serving deployment id. Confirm `reserve_transfer_file`, `claim_download_slot`, and `release_download_slot` are still absent. There is no point-in-time recovery to lean on. The rollback is a Pages deployment rollback plus, only in the state described below, dropping those three functions.

2. Preflight. In the Supabase SQL Editor, run `supabase/testing/production-sql-preflight.sql` as one statement. It is read-only. Every row is `PASS`, `FAIL`, or `REVIEW`. An absent reservation function is `PASS` before the migration. A `FAIL` stops the window. A `REVIEW` needs a person to read the detail before apply. Also confirm the recorded Pages deployment is the one serving `https://itransfer.iprudhvi.in`, and that Production `deployment_configs` still shows `RATE_LIMITER` → `itransfer-rate-limit`. Do not use Preview for a product action.

3. Approved migration. Only after a written yes that names both files:
   1. Apply `supabase/migrations/20261022193000_reserve_transfer_file.sql`.
   2. Apply `supabase/migrations/20261023004500_platform_storage_cap_and_download_slot.sql`. The second file replaces `reserve_transfer_file` with the same 16 arguments, adds the 300 GB cap (`300000000000`) and `STORAGE_CAP`, and adds `claim_download_slot(uuid, text)` and `release_download_slot(uuid, text)`. `20261023093633_raise_platform_storage_cap.sql` later replaces that `platform_limit` constant with `1000000000000`. Do not apply the raise in this step.
   3. Stop if either file errors. Do not deploy Pages.

4. Verification. Run section A of `supabase/testing/production-sql-verify.sql`. Signatures, `security invoker`, `search_path=public`, execute privileges, and `transfers_share_occupied_idx` must be `PASS`. `concurrent_share_lock` stays `REVIEW`. Until `20261023093633_raise_platform_storage_cap.sql` is applied, `platform_cap_source` FAIL and a section B result of `VERIFY_BEHAVIOR_NOT_RUN` are the expected 1 TB results. Do not treat that expected pair as a failed Phase 5 gate, and do not run section B’s writes against the 300 GB function. Require `platform_cap_source` PASS and `VERIFY_BEHAVIOR_PASS` only in Raise the platform cap to 1 TB, after that migration. When section B does run to completion, success is the error `VERIFY_BEHAVIOR_PASS`. That error aborts the transaction. After it, `select count(*) from public.transfers where file_path like 'transfers/preflight-%'` must return 0. Do not delete rows to clean it up. Section B does not open two sessions, so the concurrent share lock stays `REVIEW` in section A. The Worker argument names are `p_share_id`, `p_file_name`, `p_file_size`, `p_file_path`, `p_content_type`, `p_subject`, `p_message`, `p_sender_email`, `p_recipient_emails`, `p_request_id`, `p_password_hash`, `p_user_id`, `p_transfer_type`, `p_max_downloads`, `p_expires_at`, and `p_storage_provider`. Claims and releases send `p_file_id` and `p_share_id`.

5. Compatible Pages deployment. From the repository root, build and direct-upload with the command in the cutover checklist. That upload must be branch `main`, must include the repo-root `functions/` bundle, and must keep `RATE_LIMITER` → `itransfer-rate-limit`. Do not deploy if verification failed. An expected `platform_cap_source` FAIL before the 1 TB migration is not this stop. A signature, privilege, or index FAIL still stops the window. The checkout `phase5-safety-checkpoint-2026-10-18` is not the production branch.

6. Serving-deployment limiter verification. Read `deployment_configs` again. The new deployment id must be the one serving `https://itransfer.iprudhvi.in`, and Production must still bind `RATE_LIMITER` to `itransfer-rate-limit`. A project setting from before the deploy is not that proof.

7. Smoke tests. Send one ordinary production request that uses the limiter. It must not return `503` `RATE_LIMIT_UNAVAILABLE`. Do not send a burst. Do not use Preview. Then one guest upload of a tiny file, one download URL, and delete that test transfer. A signed-in upload is a separate check and uses a real account. Stop if the reservation returns `RECORD_FAILED`.

Rollback depends on whether the new Pages version is serving.

- Before the new Pages version serves: the recorded older deployment is still the live site and does not call the three functions. If the SQL must be undone, drop `claim_download_slot(uuid, text)` and `release_download_slot(uuid, text)`, then restore `reserve_transfer_file` from `20261022193000_reserve_transfer_file.sql` or drop that function too if the whole pair is being removed. Do not delete transfer rows. Do not deploy the new Worker after dropping the functions.
- After the new Pages version serves: roll Production back to the recorded deployment id first. Confirm `https://itransfer.iprudhvi.in/api/r2?action=health` returns the previous shape. Only after that older deployment is the one serving, and only if that deployment does not call the functions, drop them. Leaving the functions in place while the old deployment serves is safe. Dropping the functions while the new deployment is still serving makes new uploads return `RECORD_FAILED` and download claims fail. Do not do that.
- Do not change DNS, secrets, or the R2 bucket as part of this rollback.

### Cutover checklist

Not executed. Phase 5 stays open. Wrangler on this machine is 4.151.1. The last recorded production deployment, read on 23 October 2026, is `aa8a4342-92c4-42de-89dc-b9e7f905849a` on Pages project `itransfer-app`, branch `main`. Wrangler 4.151.1 has no Pages rollback command. Rollback is the dashboard action that makes the id written down in step 1 the production deployment again.

These remain outside the sequence:

- The logical backup at `~/secure-backups/sendtoanyone-20261023-123933/` is exported and unverified by a restore. The lab commands are `npm run supabase:restore-lab:start`, then `RESTORE_LAB_CONFIRM=sendtoanyone-restore-lab npm run supabase:restore-lab:restore`. Do not treat the export as a tested restore.
- Preview deployments are still reachable. The guard is not in the serving deployment. Do not delete Preview here, and do not use a `*.pages.dev` host for a product action.
- Dashboard checks still open: Resend → Domains → `sendtoanyone.com`; Supabase Authentication → URL Configuration for `giyeepztahdbsejsozog`; Cloudflare zone `sendtoanyone.com` → Security → WAF.

Run the steps in order. Stop at the first failed condition.

1. Write down the live production deployment id:

```bash
./node_modules/.bin/wrangler pages deployment list --project-name=itransfer-app --environment production --json
```

Stop if `./node_modules/.bin/wrangler --version` is not 4.151.1. The id in that production list is the rollback target. If it is still `aa8a4342-92c4-42de-89dc-b9e7f905849a`, use that id. If the list shows a different production id, use the id the list shows.

2. Run `supabase/testing/production-sql-preflight.sql` in the SQL Editor. Stop on any `FAIL`. A `REVIEW` waits for a person. The three reservation functions being absent is `PASS`.

3. After a written yes, apply `supabase/migrations/20261022193000_reserve_transfer_file.sql`, then `supabase/migrations/20261023004500_platform_storage_cap_and_download_slot.sql`. Stop if either file errors. Do not deploy. The first file creates `transfers_share_occupied_idx` and `reserve_transfer_file(text, text, bigint, text, text, text, text, text, text, text, text, text, text, integer, timestamptz, text)` as `security invoker` with `search_path=public`, revokes `public`, `anon`, and `authenticated`, and grants `EXECUTE` to `service_role`. It locks with `pg_advisory_xact_lock(hashtext('itransfer-share-v1'), hashtext(p_share_id))` and refuses a share above `6000000000` bytes. The second file replaces that function with the same 16 arguments, takes `pg_advisory_xact_lock(hashtext('itransfer-platform-v1'), 0)` before the share lock, and returns `STORAGE_CAP` above `300000000000` occupied bytes. It adds `claim_download_slot(uuid, text)` and `release_download_slot(uuid, text)` with the same invoker, search path, and execute grants. `CREATE OR REPLACE` keeps the existing `reserve_transfer_file` grants. `20261023093633_raise_platform_storage_cap.sql` later replaces that `platform_limit` constant with `1000000000000`. Do not apply the raise in this step.

4. Run section A of `supabase/testing/production-sql-verify.sql`. Stop on a signature, privilege, or index `FAIL`. `concurrent_share_lock` stays `REVIEW`. Until `20261023093633_raise_platform_storage_cap.sql` is applied, `platform_cap_source` FAIL and section B `VERIFY_BEHAVIOR_NOT_RUN` are the expected 1 TB results. Do not treat that pair as a reason to stop this historical window or to undo the 300 GB function. Require `platform_cap_source` PASS and `VERIFY_BEHAVIOR_PASS` only in Raise the platform cap to 1 TB. When section B does run to completion, success is the error `VERIFY_BEHAVIOR_PASS`. After it, this must return 0:

```sql
select count(*) from public.transfers where file_path like 'transfers/preflight-%';
```

Stop if it does not. Do not delete rows to make it 0.

5. From the repository root, with the dirty tree whose `functions/lib/r2Engine.js` calls `rpc/reserve_transfer_file` and `rpc/claim_download_slot`:

```bash
npm run build
./node_modules/.bin/wrangler pages deploy dist --project-name=itransfer-app --branch main --commit-dirty=true
```

`npm run build` is `vite build`. It writes `dist`, the `pages_build_output_dir` in `wrangler.jsonc`. Wrangler 4.151.1 uploads that directory and, because `dist/_worker.js` is absent, bundles `./functions` into the Functions bundle. `public/_routes.json` is copied into `dist` and includes `/*` except the static files, so `/api/*` stays on that bundle. The same `wrangler.jsonc` puts `nodejs_compat`, `APP_URL`, `CLOUDFLARE_R2_BUCKET`, and service binding `RATE_LIMITER` → `itransfer-rate-limit` into the bundle metadata. Stop if the log delegates to Workers, if it does not print `Uploading Functions bundle`, or if the printed environment is not production. Stop if `--branch` is omitted: this checkout is `phase5-safety-checkpoint-2026-10-18`, and Wrangler would attach that branch and create a Preview deployment. Stop if the upload is a clean checkout of `9712b80`. That commit does not contain these function calls. The attached commit hash is `9712b80` plus a dirty flag. The hash is not the function bundle.

6. Confirm the new id is the production deployment:

```bash
./node_modules/.bin/wrangler pages deployment list --project-name=itransfer-app --environment production --json
```

Stop unless that id is the one the deploy command printed. Then:

```bash
./node_modules/.bin/wrangler pages download config itransfer-app
```

Stop unless the written Production config has service binding `RATE_LIMITER` → `itransfer-rate-limit`. That file is the project config. The deployment list does not include a binding snapshot. The serving check is the next request.

7. Send one production request that uses the limiter. Stop if it returns `503` `RATE_LIMIT_UNAVAILABLE`. Then one tiny guest upload, one download URL, and delete that test transfer. Stop if the reservation returns `RECORD_FAILED`. Do not send a burst. Do not use Preview.

Before the new deployment serves, the id from step 1 is still live and does not call the three functions. SQL can be dropped only in that state: `claim_download_slot(uuid, text)`, `release_download_slot(uuid, text)`, then `reserve_transfer_file` with its 16 arguments. After the new deployment serves, roll the dashboard back to the step 1 id first, confirm `https://itransfer.iprudhvi.in/api/r2?action=health`, and only then drop the functions. Dropping them while the new deployment serves makes uploads return `RECORD_FAILED`.

### Raise the platform cap to 1 TB

This follows the rollout above. It does not replace those steps, and it does not include a Pages deploy. Phase 5 migrations are reported applied, so the serving database already enforces `300000000000`. This repository’s target is `1000000000000` (1 TB) for the whole platform, not a quota each account or paid user receives. `quotaBytes` stays `7_000_000_000` and is not this cap. `paidFeaturesEnabled` stays false.

1. Apply only `supabase/migrations/20261023093633_raise_platform_storage_cap.sql`. It replaces `platform_limit` with `1000000000000` and leaves `share_limit` at `6000000000`. It does not add or drop `claim_download_slot` or `release_download_slot`. `20261023004500_platform_storage_cap_and_download_slot.sql` is the file that added the 300 GB cap. This file replaces that constant.
2. Run `supabase/testing/production-sql-verify.sql`. Require `platform_cap_source` PASS and section B `VERIFY_BEHAVIOR_PASS`. Confirm the cap before treating 1 TB as active.
3. A later Pages deploy is required before the API returns the sentence `Stored files have reached the 1 TB platform limit.` That deploy is not part of this change. The serving Worker does not return that sentence. The database function is what enforces the cap. Until the migration in step 1 succeeds, that function still uses `300000000000`.

Rollback of this migration is `CREATE OR REPLACE` of `reserve_transfer_file` back to the body in `20261023004500_platform_storage_cap_and_download_slot.sql`. Do not drop `claim_download_slot` or `release_download_slot`.
