# SendToAnyone security audit

This is a code and local-test review of the working tree on `phase5-safety-checkpoint-2026-10-18`. It is not a penetration test and not a certification. The deployed site at `https://itransfer.iprudhvi.in` is not proven to be running this tree. Phase 5 reservation migrations are reported applied, and upload and download work. The serving platform cap is still 300 GB (`300000000000`) until `supabase/migrations/20261023093633_raise_platform_storage_cap.sql` is applied and verification passes.

Identity comes only from `Authorization: Bearer` checked with Supabase `GET /auth/v1/user`. Request body fields such as `userId` or `userPlan` are not an identity. A missing bearer is a guest. An invalid bearer is `401 AUTH_INVALID`.

## Upload pause

`UPLOADS_PAUSED=1` or `true` blocks `open-transfer`, `get-put-url`, `initiate-upload`, `get-part-url`, and `get-part-urls`. Those routes return `503 UPLOADS_PAUSED` before a reservation or a new signature.

`complete-upload` and `finalize-upload` stay open so an upload that already has bytes can be size-checked and marked active. Downloads, deletion, and cleanup stay open.

A URL signed before the pause stays valid until it expires. Upload signatures last 900 seconds and name one method and one object path. The server cannot revoke them. After they expire, pause blocks further part URLs. An unfinished reservation remains occupied until cleanup. The pause is not enabled in `wrangler.jsonc`.

## Signed URLs

The Worker builds the object key as `transfers/{time}-{random}/{sanitized name}`. The client does not choose the directory. `..`, slashes, nulls, and the other ASCII control characters are removed from the file name. A download `customFileName` is passed through that same cleaner before it is placed in `response-content-disposition`. Carriage return, line feed, and the Unicode line separators cannot remain in that header value. Part and complete calls must present the delete token for that share, and the row must still be `pending` with the same multipart upload id.

`activateObject` HEADs the object and rejects it unless `Content-Length` equals the reserved `file_size` and is within 6 GB. A mismatch deletes the object and marks the row `rejected`. That check is the point where a lied size stops becoming an active transfer. It runs on `finalize-upload` and `complete-upload`, not at the moment the first PUT URL is signed. The reservation itself still refuses a declared size over 6 GB or a share total over 6 GB.

## Storage accounting

Enforced in this working tree after `supabase/migrations/20261023093633_raise_platform_storage_cap.sql`: one share stays at or under `6_000_000_000` bytes, and every occupied row on the platform stays at or under `1000000000000` bytes (1 TB). That figure is the whole platform, not a quota each paid user receives. Equal to the cap is allowed. Occupied rows are `pending`, `active`, `pending_delete`, and null. `rejected`, `expired`, and `released` do not count. The check is a transaction lock and a sum, so a rolled-back insert does not keep the bytes. Legacy rows are included because the sum reads the table. Disposable Postgres covered two shares at the boundary, rollback, release, `pending_delete`, and a null status. `20261023004500_platform_storage_cap_and_download_slot.sql` still adds the 300 GB cap; the new migration replaces that constant.

`STORAGE_POLICY.quotaBytes` is still 7 GB and `canReserve` has no caller. That is not the platform cap. `paidFeaturesEnabled` stays false.

Production still enforces the 300 GB cap (`300000000000`) until `20261023093633_raise_platform_storage_cap.sql` is applied and verification passes. After that, the serving cap is 1 TB. The Worker sentence in this tree says 1 TB and is not live until a later Pages deploy. The database function is what enforces the cap.

## Download limits

`download-url` counts issuance of a signed GET, not each later fetch of that URL. `claim_download_slot` locks the file and increments `download_count` only when the file is active and under its limit. `0` means unlimited and still increments, so the owner can see use. If signing throws, `release_download_slot` gives that issuance back. The URL lasts 900 seconds, cannot be revoked, and can be downloaded more than once. Routing the file bytes through the Worker would make one HTTP GET equal one count, and it would also put every download through the Worker. That was not done.

The slot function is not on production. The live path can still race.

Failed R2 deletion does not mark the row expired and does not consume the delete token. Abandoned single-PUT rows are released only after the object is gone or already missing.

## Authentication and guests

Public share links are bearer access by share id. A password is checked only from `x-transfer-password`. Body and query passwords are ignored. Download limits are per file. `0` means unlimited.

Guests open a transfer with separate claim and delete tokens, stored as SHA-256. Upload and delete use the delete token. Claim assigns `user_id` once. Replay after `used_at` is rejected.

Owner list, rename, and delete require the Supabase user id on the rows, with a narrow guest-email fallback for rename. One user cannot rename or delete another user's share by id. File requests are created and closed only by the signed-in owner. A guest may upload into an open request. The request owner cannot delete that guest transfer by user id.

Cleanup, `delete-object`, and `ensure-cors` require `x-cleanup-secret`. Production uses the Worker secret. Isolated mode accepts only a `local-` prefixed test secret.

## Rate limits

The Pages binding `RATE_LIMITER` is shared across isolates when it is configured. A missing or bad response fails closed for upload, download, claim, delete, email, and part URLs. `verify-password` and a password-protected `download-url` call the shared `PASSWORD_LIMIT` bucket, 8 per 60 seconds, before comparing a password. The key is a hash of the share id and `cf-connecting-ip`. The password is not part of the key. An in-memory map of 8 failures per share per minute still applies inside one isolate after that bucket allows the attempt. Whether the live Pages project actually has the binding is a Phase 5 setting, not an open code path.

## Secrets and local exposure

`VITE_` keys that look like service-role, cleanup, or Resend secrets are rejected in isolated mode. The isolated env file is gitignored. The repository `.env` names the production bucket and is not loaded by isolated Vite.

Supabase ports `55421`–`55424` were not listening at the end of this review. During the later local run they listened on `127.0.0.1` only, and the stack was stopped again afterward. MinIO is on `127.0.0.1:9000` and `[::1]:9000`. Isolated Vite is on `127.0.0.1:5174`.

`npm audit --omit=dev` after the 23 October patch overrides: 0 critical, 5 high, 2 moderate. The patch moved Vite to 8.2.4, source-map-js to 1.2.2, and fast-uri to 3.1.9. Nodemailer, mysql2, Prisma, and deepmerge-ts remain. No major upgrade was made. Prisma and mysql2 are not on the Pages upload path.

## CORS and headers

API JSON responses send `access-control-allow-origin: *` with `Authorization`, `X-Transfer-Password`, and `X-Cleanup-Secret`. That is required for a public share link on another origin and also means any site can call the API if it has a token. Tokens are not cookies. `public/_headers` sets `nosniff`, `SAMEORIGIN`, and HSTS for the static site.

## Phase 2 closeout

Reviewed on 23 October 2026 against this working tree: `previewGuard.js`, `r2Engine.js`, password verification, signed URLs, and cleanup authorization. The one new code defect was `customFileName`. `sanitizeFileName` treated carriage return and line feed as allowed whitespace, so they could be copied into the signed `response-content-disposition` value. Control characters are now removed, and a mock download covers a hostile name. A password in the query string does not unlock a download. The header `x-transfer-password` still does.

No further code-level authorization, token, rate-limit, upload, download, or secret-handling defect was found. Preview host checks already fail closed for a `*.itransfer-app.pages.dev` host that is not the production apex, and they stay closed when the Preview environment points at production Supabase, the production bucket, or a missing limiter. Cleanup, `delete-object`, and `ensure-cors` still require `x-cleanup-secret`.

Verdict for this source review: **PASS**.

## Phase 5 settings, not code defects

These remain outside Phase 2. They are not unresolved defects in this tree.

- Phase 5 migrations are reported applied. The serving cap remains 300 GB (`300000000000`) until `20261023093633_raise_platform_storage_cap.sql` replaces `platform_limit`. Do not deploy Pages as part of that cap change. Do not drop `claim_download_slot` or `release_download_slot` to roll the constant back.
- The live Pages `RATE_LIMITER` binding was not settled from the dashboard.
- Preview still uses production `APP_URL` and the production bucket in the last project read. Do not deploy Preview.
- The isolated stack published `127.0.0.1:55421` through `127.0.0.1:55424` on 23 October 2026, and the two isolated live tests passed. That does not change the production gates above.
- WAF, Auth redirect URLs, Resend domain status, and the cleanup notification were not confirmed from this login.

This closeout did not call production, did not send mail, did not deploy, and did not start Docker.
