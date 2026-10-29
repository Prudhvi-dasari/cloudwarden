# SendToAnyone security test matrix

Actions are on `/api/r2` unless noted. “Mock” is `tests/phase1-security.test.mjs` or `tests/uploads-paused.test.mjs`. “Postgres” is a disposable cluster, not production. “Live” is the earlier isolated Supabase and MinIO run. This phase did not repeat live tests because that Supabase stack is stopped.

| Action | Auth | Guest | Ownership check | Storage effect | Limit | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| `health` | No | Yes | None | None | None | Pause test: still 200 |
| `tier-limits` | No | Yes | None | None | Returns free 6 GB and 168 hours | Mock |
| `open-transfer` | Optional bearer | Yes | New share | Writes claim and delete hashes | Upload rate limit. Paused. | Mock guest tokens. Pause test |
| `get-put-url` | Delete token | Yes, with token | Token share must match | Reserves row, signs PUT for 900s | 6 GB share and 1 TB (`1000000000000`) platform before sign, after `20261023093633_raise_platform_storage_cap.sql`. Production still enforces 300 GB until that migration. Paused | Mock cap. Disposable Postgres platform test |
| `initiate-upload` | Delete token | Yes, with token | Same as PUT | Reserves row, starts multipart | 6 GB and 1 TB before session. Production still enforces 300 GB until the new migration. Paused | Mock |
| `get-part-url`, `get-part-urls` | Delete token | Yes, with token | Pending row, same upload id and share | Signs up to 5 PUTs | Paused. Limiter failure does not sign | Mock five-part cap. Pause test. Limiter-down test |
| `complete-upload` | Delete token | Yes, with token | Same pending row | Completes multipart, HEAD size must match | Not paused, so a started upload can finish | Mock lifecycle |
| `finalize-upload` | Delete token | Yes, with token | Path must belong to the token share | HEAD size must match or row is rejected | Not paused | Mock size path via activate |
| `share-meta` | No | Yes | Public active rows | Read. No password hash, token, or object key | Download rate policy on the read | Mock hides secrets |
| `download-url` | No | Yes, share id and file id | Active, unexpired row | Signs GET for 900s after `claim_download_slot` increments | Per-file limit. Password header only, after `PASSWORD_LIMIT` allows it. A query or body password does not unlock the file. `customFileName` cannot keep a carriage return, line feed, or Unicode line separator in `response-content-disposition`. Count is the URL, not each R2 GET | Mock overlap, password-bucket block, hostile filename, query-password rejection, and disposable Postgres overlap |
| `verify-password` | No | Yes | Share row | None | Shared `PASSWORD_LIMIT` before the hash is read. Isolate map still counts failures | Mock allow, block, unavailable, and 8-then-block |
| `claim` | Bearer plus claim token | No | Token share must match | Sets `user_id`, consumes token | Claim rate limit | Mock and prior live replay test |
| `delete-own` | Delete token or owner bearer | Yes, with delete token | Token share, or every row `user_id` | Deletes objects, then marks expired | Delete rate limit. Failed delete does not expire | Mock |
| `rename-transfer` | Bearer | No | `user_id`, or guest row with the same email | Subject only | Auth required | Mock IDOR |
| `my-transfers` | Bearer | No | Rows for that user id, plus guest rows with that email | Read | Auth required | Prior live test |
| `create-request` | Bearer | No | Owner is the auth user | Inserts request | Request rate limit. Not an upload | Mock |
| `close-request` | Bearer | No | `owner_user_id` | Sets closed | Auth required | Prior live test |
| `request-meta` | No | Yes | Open request only | Public fields | Rate limit before read | Mock |
| `my-requests` | Bearer | No | Owner id | Read | Auth required | Prior live test |
| `cleanup` | `x-cleanup-secret` | No | Service | Deletes expired or abandoned objects, then updates status | Secret required. Batch 200 | Mock failure does not release |
| `delete-object` | Cleanup secret | No | Key must start with `transfers/` or `requests/` | Deletes one object. Does not change the row | Secret required | Mock |
| `ensure-cors` | Cleanup secret | No | Bucket CORS | Writes bucket CORS | Secret required | Mock |
| `admin-summary` | Bearer in the admin email set | No | Auth user email | Read of recent rows | Not a public report | Code inspection. Not a live admin test |
| `POST /api/send-email` | No session | Caller must pass mail preparation | Prepared payload only | Sends only when the shared limiter allows | Held, not sent, when limited or unavailable | Mock |

Database: `anon` and `authenticated` cannot execute `reserve_transfer_file`, `claim_download_slot`, or `release_download_slot`. The functions are invoker with `search_path=public`. Service role can execute them. Two overlapping reservations on one share take the share lock. Two reservations on different shares take the platform lock. Occupied bytes cannot pass 1 TB (`1000000000000`) after `20261023093633_raise_platform_storage_cap.sql`. Production still enforces 300 GB (`300000000000`) until that file is applied. That 1 TB evidence is disposable Postgres, not production.
