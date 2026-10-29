# SendToAnyone current limits

Decimal sizes use `1_000_000_000` bytes per GB. The free transfer cap is `6_000_000_000` bytes, not a binary gibibyte figure. The homepage byte formatter still uses 1024 for display.

## Enforced on the server

| Rule | Value | Where |
| --- | --- | --- |
| One transfer, all occupied files | `6_000_000_000` bytes | `reserve_transfer_file` and `sizeError` before `get-put-url` and `initiate-upload` |
| Whole platform, occupied files | `1000000000000` bytes (1 TB) in this repository | `reserve_transfer_file` after `supabase/migrations/20261023093633_raise_platform_storage_cap.sql`. Equal to the cap is allowed. This is the whole platform, not a quota each account or paid user receives. Production still enforces `300000000000` until that file is applied and verification passes. `20261023004500_platform_storage_cap_and_download_slot.sql` still adds the 300 GB cap; the new file replaces that constant |
| Free retention | 168 hours | `retentionHours` clamps anything outside 1–168 to 168. File-request links use 168. |
| Occupied statuses | `pending`, `active`, `pending_delete`, and null | `rejected`, `expired`, and `released` do not count |
| Single-PUT abandon | Presign lifetime 900 seconds plus 60 seconds | Released only after object delete succeeds or returns 404 |
| Multipart with a future expiry | Kept | Age alone does not release a pending row that has an upload id |
| Download limit | Per file. `0` means unlimited. The count is one signed URL, not one R2 GET. The owner summary says “links issued” | `claim_download_slot` locks the row and increments before signing. A limit of 1 allows one URL. That URL can be reused until it expires, 900 seconds. Proxying every storage fetch was not added. Overlapping requests cannot pass the limit. Phase 5 migrations are reported applied |
| Password verification | Shared `PASSWORD_LIMIT`, 8 per 60 seconds | `verify-password` and a password-protected `download-url` send a SHA-256 of the share id and `cf-connecting-ip`. Neither compares a password unless that bucket allows the request. Production has no `RATE_LIMITER` binding, so this path stays inactive until that binding is configured. |
| Upload pause | Off unless `UPLOADS_PAUSED` is `1` or `true` | See below |

Guest and signed-in uploads both call `get-put-url` or `initiate-upload`. Both paths call `reserveTransferRow`. A second retry of the same bytes is a new reservation unless the caller reuses the same object key and the first row is still pending. The database unique constraints do not dedupe a repeated file body.

Failed object deletion does not set a live pending row to `released`. Successful cleanup of an expired object marks the row expired. Abandoned single-PUT rows are marked `released` only after the object is gone. That release happens once for that row because a later scan no longer selects `released`.

`platformQuotaBytes` is `1000000000000`, the whole-platform cap in this repository, not a quota each paid user receives. Production still enforces `300000000000` until `supabase/migrations/20261023093633_raise_platform_storage_cap.sql` is applied and verification passes. After that, the serving cap is 1 TB. The Worker sentence in this tree says 1 TB. That sentence is not live until a later Pages deploy, which is not part of this change. The database function is what enforces the cap.

## Not enforced on production

`STORAGE_POLICY.quotaBytes` is `7_000_000_000`. Nothing calls `canReserve`. That constant is not the platform cap. Paid plans stay disabled (`paidFeaturesEnabled` is false).

The shared rate limiter fails closed when the `RATE_LIMITER` binding is missing, including `get-part-url` and `get-part-urls`. Isolated Vite uses an in-memory limiter. The Worker `itransfer-rate-limit` is deployed with upload 30, parts 120, download 120, password 8, claim 20, delete 20, request 10, and email 5, each per 60 seconds, namespaces `910001`–`910008`. A separate local config, `wrangler.rate-limit.preview.jsonc`, uses the same limits on namespaces `910101`–`910108` and the name `itransfer-rate-limit-preview`. That Worker was not deployed. The Pages project API lists `RATE_LIMITER` → `itransfer-rate-limit` on Production and on Preview. Preview’s `APP_URL` in that payload is still `https://itransfer.iprudhvi.in`, and its bucket is still `itransfer-storage`. An earlier dashboard view the same day did not show the binding. The deployed commit `4bce02c` does not declare it. On a Preview hostname the guard also refuses the request when that binding or `RATE_LIMIT_SCOPE=preview` is missing. `verify-password` and a password-protected `download-url` call the password bucket before they compare a hash. A wrong-password counter of 8 per share per minute still lives in each isolate and still applies after the shared bucket allows the attempt.

On 23 October 2026 a disposable Postgres database with 4,000 occupied rows reserved one more file in 3.687 ms, and a later run the same day did it in 13.207 ms. A 100,000-row run reserved one file in 107.287 ms and then 25.491 ms. The occupied sum was a sequential scan of those rows in 76.701 ms and then 24.828 ms. A second reservation blocked on the platform advisory lock and finished 126 ms, then 63 ms, after the holder committed. The Phase 4 closeout run reserved one file in 54.779 ms, summed occupied bytes in 48.638 ms, and finished the waiting reservation 63 ms after the holder committed. The waiter was already on `Lock/advisory` after 47 ms. `reservationArgs` sends the same 16 named arguments as both `reserve_transfer_file` definitions. Download claims and releases send `p_file_id` and `p_share_id`. No leaked reservation, double claim, or bad state transition was reproduced. That database is a fresh cluster plus a handcrafted `public.transfers` table and the tracked iTransfer migrations. It is not a copy of the production schema. A later catalog read of `tranferfiles` on 23 October 2026 found the three reservation functions absent. That sentence records the catalog read. It is not the current inventory: Phase 5 migrations are reported applied, and the serving cap is 300 GB until the 1 TB migration. The live insert columns exist with matching types, including `recipient_emails text` and `user_id uuid`. Live differences from the handcrafted table are a foreign key from `user_id` to `auth.users`, nullable `expires_at`, and a `download_logs jsonb` column the insert does not write. That catalog read is not an execution of the migration. The oldest tracked migration still fails there because it expects AURO `group_posts`. These timings come from that disposable cluster. The isolated Supabase stack was started on the `itransfer-isolated` bridge and then stopped, because Docker Desktop published `55421`–`55424` on every interface. MinIO stayed on `127.0.0.1:9000` with bucket `itransfer-local`. The live isolated transfer tests could not run.

## Operator upload pause

Set the Pages variable `UPLOADS_PAUSED` to `1` or `true`. Leave it unset, empty, or `0` for normal operation. `wrangler.jsonc` does not set it.

While paused, `open-transfer`, `get-put-url`, `initiate-upload`, `get-part-url`, and `get-part-urls` return HTTP 503 and `UPLOADS_PAUSED`. They do not insert a reservation or sign a new upload. `complete-upload` and `finalize-upload` stay available so bytes already accepted can be checked and activated. Health, downloads, deletion, and cleanup stay available. Creating a file-request record is still allowed, but uploading into it is not.

A presigned URL that was issued before the pause cannot be revoked. Its lifetime is `uploadUrlSeconds` (900 seconds) and it authorizes only the signed method and object path. After that, no new part URL is issued while the pause remains. An unfinished reservation stays occupied until cleanup or expiry. This is not a guarantee that every in-flight byte stops at the moment the variable is set.

This is application enforcement. A Cloudflare billing alert does not stop uploads.

## Cost model

These are estimates from published prices read on 23 October 2026. They are not an invoice, a quota reading, or a spending cap. The account’s Workers subscription could not be read. R2 stored bytes were not read. Nothing below stops an upload by itself.

Prices used:

- Cloudflare R2, [R2 pricing](https://developers.cloudflare.com/r2/pricing/) updated 1 October 2026. Standard storage `$0.015` per GB-month. Class A `$4.50` per million. Class B `$0.36` per million. Free allowance: 10 GB-month, 1 million Class A, 10 million Class B. Egress is free. `DeleteObject` and `AbortMultipartUpload` are free. `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, and `ListObjects` are Class A. `HeadObject` and `GetObject` are Class B. Cloudflare rounds usage up to the next billing unit. Their example bills 1,000,001 operations as 2 million, and 1.1 GB-month as 2 GB-month. Infrequent Access is not used.
- Cloudflare Workers and Pages Functions, [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) updated 2 October 2026 and [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) updated 8 September 2026. Free: 100,000 requests per day and 10 ms of CPU per invocation. Paid: `$5` per month, then 10 million requests and 30 million CPU-milliseconds included, then `$0.30` per extra million requests and `$0.02` per extra million CPU-milliseconds. Static asset requests are free. Worker subrequests are not billed as extra requests. Pages Functions count toward the same quota.
- Supabase, [About billing](https://supabase.com/docs/guides/platform/billing-on-supabase), read 23 October 2026. The `iprudhvi` organization is on the Free plan, which allows two projects and already has two. Free quota: 500 MB database per project, then the project becomes read-only; 5 GB uncached egress and 5 GB cached egress, with no overage charge; 50,000 monthly active users. File bytes in this app go to R2, so they are not Supabase Storage and they are not Supabase egress.
- Resend, [Resend pricing](https://resend.com/pricing/), read 23 October 2026. Free: 3,000 emails per month and 100 per day, with no overage. Pro: `$20` per month for 50,000 emails, then `$0.90` per extra 1,000. That plan was not purchased.

Assumptions, all labeled as assumptions:

- One file per transfer, at the average size in the table.
- Each file lives 168 hours, so GB-month is `transfers × size in GB × 7 / 30`.
- Files of this size use multipart. The part size in `src/lib/uploadPlan.js` is 16 MiB. A 500 MB file is 30 parts, a 1 GB file is 60, and a 2 GB file is 120.
- Each transfer does one `CreateMultipartUpload`, one `UploadPart` per part, one `CompleteMultipartUpload`, one `HeadObject` at finalize, and two `GetObject` downloads. Cleanup `DeleteObject` calls are free.
- Cleanup also lists the bucket once an hour. The estimate uses one list page per hour, 720 Class A operations a month. The code stops at five pages, which would be 3,600.
- Each transfer makes one `open-transfer`, one `initiate-upload`, one part-URL call per five parts, one finalize, two `download-url` calls, and one email request. Cleanup adds one Pages request and one scheduler invocation per hour.
- One recipient email per transfer. The code allows up to 10 recipients, which would multiply the email column.

| Scenario | Transfers | Average size | R2 storage | R2 operations | Workers and Pages | Supabase | Email |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Low | 100 | 500 MB | 11.7 GB-month. About `$0.03` after the 10 GB allowance, because 1.7 GB rounds up to 2 GB | About 3,900 Class A and 300 Class B. Inside both free allowances | About 2,500 requests in the month. Inside the free daily cap if they are spread out | About 100 rows. Inside 500 MB and 5 GB egress | 100 messages. Inside the free month. One calendar day of 100 is the free daily ceiling |
| Medium | 2,000 | 1 GB | 467 GB-month. About `$6.86` for the 457 GB billed above 10 GB | About 125,000 Class A and 6,000 Class B. Inside both free allowances | About 37,000 requests. Inside the free daily cap if they are spread out | About 2,000 rows. Still inside the free database and egress quotas | 2,000 messages. Inside 3,000 per month. An even month is about 67 a day. A day over 100 is refused by the free Resend plan |
| High | 20,000 | 2 GB | 9,333 GB-month. About `$140` for the 9,324 GB billed above 10 GB | About 2.44 million Class A. The raw excess over 1 million is about `$6.48`. The published rounding example can make that excess two million units, about `$9`. Class B stays near 60,000, inside the free allowance | About 600,000 requests, near 20,000 on an average day. That fits under 100,000 a day when traffic is smooth. A busy day can hit the free daily stop. On Workers Paid the same count is inside the 10 million included requests, and the `$5` subscription is separate | About 20,000 rows of metadata. Still small against 500 MB. File bytes are not in this database | 20,000 messages. The free plan stops at 3,000 and does not sell the rest. The published Pro plan at `$20` includes 50,000. It was not bought |

The 6 GB share ceiling does not cap the medium or high storage totals. This repository’s platform cap is 1 TB (`1000000000000`). Production still enforces 300 GB (`300000000000`) until `supabase/migrations/20261023093633_raise_platform_storage_cap.sql` is applied and verification passes. A Cloudflare or Resend billing email does not stop uploads.

## What actually stops usage

| Control | Where it stands |
| --- | --- |
| 6 GB declared-size check and `reserve_transfer_file` | In this working tree. Phase 5 migrations are reported applied, and upload and download work. The per-transfer cap stays `6000000000` |
| 1 TB platform cap (`1000000000000`) | Repository target in `supabase/migrations/20261023093633_raise_platform_storage_cap.sql`. Production still enforces 300 GB (`300000000000`) from `20261023004500_platform_storage_cap_and_download_slot.sql` until the new migration is applied and `platform_cap_source` plus section B pass. `claim_download_slot` shipped with that earlier file. The API sentence in this tree says 1 TB and is not live until a later Pages deploy |
| 168 hour retention | Clamped in this working tree. Expired rows leave storage only when cleanup deletes the object. The live cron expression was not in the deployed version view |
| R2 incomplete-multipart abort after 7 days | Confirmed on the bucket. It does not delete a finished object |
| `UPLOADS_PAUSED` | Enforced by this working tree when the variable is `1` or `true`. It is unset. It does not revoke a URL already signed |
| Shared rate limits | Enforced by this working tree when `RATE_LIMITER` answers. The Pages binding was not settled, and the deployed commit does not declare it |
| Resend free daily and monthly ceilings | Enforced by Resend, outside this repository. This code does not count a monthly email total |
| Supabase 500 MB read-only mode and 5 GB egress restriction | Enforced by Supabase on the Free plan. This repository does not set a database size cap |
| Workers free daily request cap and 10 ms CPU cap | Enforced by Cloudflare if the account is on Workers Free. The subscription list returned HTTP 403, so the plan was not confirmed |
| Billing notifications and the cleanup exception | A notification email is not a cap. `cleanup-scheduler.js` throws when cleanup does not return the success JSON. That exception is the cleanup alert. It shows in Workers Logs only on a deployed version with observability enabled. The notification-policy API returned HTTP 403, so a dashboard notification was not confirmed |
