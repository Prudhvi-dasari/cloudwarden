# SendToAnyone email configuration checklist

Documentation only. No DNS record, Resend setting, or Supabase Auth setting was changed. No email was sent. Public DNS was read on 23 October 2026. Resend’s dashboard was not opened, so domain verification is still unverified. Placeholders below stay empty until those values are copied from the authenticated Resend domain page.

## Read-only results for mail

| Item | Status | Evidence | Manual action |
| --- | --- | --- | --- |
| Pages mail route is deployed | Verified | `OPTIONS https://itransfer.iprudhvi.in/api/send-email` returned 200 and allowed `POST, OPTIONS` with header `Content-Type`. That matches `functions/api/send-email.js` | None |
| `RESEND_API_KEY` | Present and encrypted. Value not read | `npx wrangler pages secret list --project-name itransfer-app` | Do not print it. Do not send a test during this audit |
| `EMAIL_FROM_ADDRESS` | Present and encrypted. Value not read | The same secret list | The code default `send@sendtoanyone.com` is only the fallback when this secret is empty. It is not empty. The live From address is still unknown until someone reads it in the dashboard or a mailbox test |
| Resend domain `sendtoanyone.com` | BLOCKED | No Resend API call was made. There is no `resend` CLI, and `RESEND_API_KEY` was not in the shell. The Pages secret was not read. A DKIM TXT at `resend._domainkey.sendtoanyone.com` is public DNS, and that is not the Resend verified badge | Open Resend → Domains → `sendtoanyone.com`. Record Verified or not. Do not paste SPF or DKIM values into this file |
| Public DKIM TXT | Present | DNS for `resend._domainkey.sendtoanyone.com` has a TXT record. A later read the same day still found one TXT. The key text is not copied here | Compare it with Resend. A published TXT is not the Resend “verified” badge |
| SPF on `sendtoanyone.com` | Missing | Public DNS showed no SPF TXT. The later read still showed one Google site-verification TXT and no SPF | Add one only from the Resend screen, after the sender domain is accepted |
| DMARC on `sendtoanyone.com` | Verified public policy | `v=DMARC1; p=none;`. The later read returned the same policy. No MX was present | Leave it |
| iCloud mail on `iprudhvi.in` | Verified public records | MX and SPF `include:icloud.com`, DMARC `p=quarantine` | Do not change them |
| Cloudflare Email Routing | NOT CONFIGURED | `npx wrangler email routing list` on 23 October 2026 returned no zones with Email Routing | The transfer sender is the Pages Resend function, not Email Routing. Do not enable routing in this phase |
| Cloudflare Email Sending | UNVERIFIED | `npx wrangler email sending list` returned Unauthorized, API code 2036. That is not a status of on or off | Do not treat this error as proof the feature is off, and do not enable it |
| Supabase Auth redirects | UNVERIFIED | Project `tranferfiles` (`giyeepztahdbsejsozog`) is `ACTIVE_HEALTHY`. The database has no `auth` config table. Site URL and redirect URLs are dashboard settings | See the Auth dashboard check below. Do not change them |
| Bounces and suppressions | Missing in the app | No webhook in the repo. Resend events were not read | A later mailbox test is still required |

References: [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [manage domains](https://resend.com/docs/dashboard/domains/manage-domains), [DMARC](https://resend.com/docs/dashboard/domains/dmarc).

## Which code sends mail

Production Pages uses `functions/api/send-email.js`. That file calls `prepareTransferMail` and `deliverTransferMail` in `functions/lib/mailService.js`, which posts to `https://api.resend.com/emails`.

`api/send-email.js` is a legacy handler. It is not the Pages function. It can use `SMTP_USER` and `SMTP_PASS`, then `RESEND_API_KEY`, then `BREVO_API_KEY` or `SENDINBLUE_API_KEY`. Do not configure those legacy variables on Pages and expect this file to run. Do not copy an old SMTP password into the Pages project.

The homepage calls `POST /api/send-email` after a completed email-mode transfer. Creating a file request does not call that route. The `file_request` and `expiry_reminder` templates exist. Nothing in `src/` posts `eventType: file_request`. A client can still post that event type directly to the API.

Password text is not included. The message says a password is required and that the sender must share it separately.

`describeEmailResult` treats provider acceptance as not delivered. A response of `status: accepted` and `delivery: unconfirmed` means Resend accepted the API call.

## Sender domain

This is unresolved.

| Source | Address or origin | What it decides |
| --- | --- | --- |
| `DEFAULT_EMAIL_FROM` | `SendToAnyone <send@sendtoanyone.com>` | From header when `EMAIL_FROM_ADDRESS` is unset |
| `wrangler.jsonc` `APP_URL` | `https://sendtoanyone.com` | Links inside the message, via `applicationOrigin` |
| Public canonical tag | `https://sendtoanyone.com/` on the homepage, and `https://sendtoanyone.com/<path>` on each public page | The page’s own canonical URL |
| `iprudhvi.in` mail | iCloud MX and SPF `include:icloud.com` | Existing mailbox domain. Not the code’s default From domain |

`send@sendtoanyone.com` is the code default. It is not proof that Resend has verified `sendtoanyone.com`, and it is not proof that production has set `EMAIL_FROM_ADDRESS`. `send@iprudhvi.in` appears only as an admin allow-list address in `r2Engine.js`. It is not the transfer From address.

Do not switch the From domain to `iprudhvi.in`. That domain already sends through iCloud. Transfer links and canonical tags use `https://sendtoanyone.com`.

## Environment names the Pages function reads

| Name | Required to send | Secret | If missing | Status |
| --- | --- | --- | --- | --- |
| `RESEND_API_KEY` | Yes | Yes | `deliverTransferMail` returns the mailto fallback and does not call Resend. Reason `no_smtp_configured` | Name verified. Production presence unverified |
| `EMAIL_FROM_ADDRESS` | No | No | From becomes `SendToAnyone <send@sendtoanyone.com>` | Default verified. Override unverified |
| `EMAIL_REPLY_TO` | No | No | Reply-To is the typed sender email, or omitted | Name verified. Value unverified |
| `APP_URL` | No | No | Links use `https://sendtoanyone.com` | Set in `wrangler.jsonc` |
| `RATE_LIMITER` | Yes for a real send | Binding | The function returns HTTP 200 with `reason: limiter_unavailable` and does not call Resend | Binding name verified. Production health unverified |

Isolated Vite does not serve `/api/send-email` and rejects a file that contains `RESEND_API_KEY`.

## Application send behavior

| Behavior | Evidence | Status |
| --- | --- | --- |
| POST only | Other methods return 405. OPTIONS allows `POST` and `Content-Type` | Verified in code |
| Recipients | At most 10 valid addresses. Duplicates and invalid addresses are counted as excluded | Verified in code |
| Share id | Required with at least one recipient. The link is always `{origin}/d/{shareId}`, including for a `file_request` event | Verified in code |
| Idempotency | SHA-256 of `itransfer-mail:{shareId}:{recipient}`, sent as `Idempotency-Key` | Verified in code |
| Retry | One extra attempt when the first result is not ok and not permanent | Verified in code |
| HTTP 409 | `invalid_idempotent_request` is a mismatch and is not success. Another 409 is uncertain and is not retried as a new send | Verified in code |
| Rate limit | Bucket `email`. A block or an unavailable limiter holds the mail. HTTP status is still 200 | Verified in code |
| Timeout | 8 seconds per attempt | Verified in code |
| Provider success | HTTP 2xx stores `delivery: unconfirmed` | Verified in code |
| Bounce, complaint, suppression | No webhook route and no suppression list in this repo | Absent from the repo. Dashboard state unverified |

## Public mail DNS already present

These are observations, not instructions to recreate the records. Token bodies for Google and Apple verifications are omitted.

| Name | Observed | Conflict if a new record is added blindly |
| --- | --- | --- |
| `iprudhvi.in` MX | iCloud, priority 10, two hosts | Replacing MX stops existing inbound mail |
| `iprudhvi.in` TXT | SPF `v=spf1 include:icloud.com ~all`, plus Google and Apple verification TXT records | A second SPF TXT is invalid. Editing the iCloud include can break current mail |
| `_dmarc.iprudhvi.in` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | This policy is for the existing domain. Do not loosen it for SendToAnyone |
| `sendtoanyone.com` MX | None | The name can still be a send-only domain. It cannot receive mail until an approved MX exists |
| `sendtoanyone.com` TXT | A Google site-verification TXT. No SPF TXT | Add SPF only as the single record Resend shows. Do not delete the Google TXT |
| `_dmarc.sendtoanyone.com` | `v=DMARC1; p=none;` | Already monitoring-first. Do not replace it with `quarantine` or `reject` |
| `resend._domainkey.sendtoanyone.com` | A TXT record is published | Compare it with Resend. Do not publish a second value at this name from memory |
| `resend._domainkey.iprudhvi.in` | No record | Leave it that way |

A published DKIM TXT does not prove Resend shows the domain as verified, and it does not prove production mail uses `send@sendtoanyone.com`.

## Resend verification workflow

Do this only after the sender domain is chosen. The code default points at `sendtoanyone.com`. Confirmation that Resend has verified it is still required.

1. Sign in to Resend and open the domain. Do not create a second domain for `iprudhvi.in` as part of transfer mail.
2. Copy the records Resend shows. Expected names, with values left blank on purpose:

| Type | Host | Value | Purpose |
| --- | --- | --- | --- |
| TXT | The SPF host Resend shows, often the apex | `<paste SPF from Resend>` | Authorizes Resend to send |
| TXT or CNAME | The DKIM host Resend shows. A TXT already exists at `resend._domainkey.sendtoanyone.com` | `<paste DKIM from Resend>` | Signature. If the dashboard value matches the published TXT, add nothing |
| TXT | `_dmarc.sendtoanyone.com` | Already `v=DMARC1; p=none;` | Keep this until reports exist. Resend’s suggested DMARC, if different, is not a reason to jump to `reject` |

3. If the zone already has the Google verification TXT, add the SPF record beside it. Do not merge unrelated TXT strings into one record unless Resend’s value is the whole record.
4. Wait until Resend shows the domain verified. A green DNS lookup from this repository is not that screen.
5. Only then set Pages `EMAIL_FROM_ADDRESS` to the verified address, if it should differ from the code default. Use a plain variable, not a secret. Production and preview should not share a live sending domain if preview can be called by the public.
6. Send the tests below before any DMARC policy change.

## DMARC

`sendtoanyone.com` already publishes `p=none`. That is the monitoring-first policy. Leave it. Read aggregate reports, if the record later gains an `rua` address copied from Resend, before considering `quarantine`. `p=reject` is not a step in this phase.

`iprudhvi.in` is already `p=quarantine` for iCloud. Do not edit it to make transfer mail pass.

## Test procedure

Use a mailbox you control. Do not send to a purchased list. Do not use a production transfer that contains someone else’s files.

1. Confirm `RESEND_API_KEY` is present in the Pages production environment and is a secret. Do not print it.
2. Complete one small transfer in email mode on `https://sendtoanyone.com` to that mailbox.
3. In the product UI, accept only the “accepted, delivery not confirmed” state as provider acceptance.
4. In the mailbox, confirm the message arrived, the From domain matches the chosen sender, the link is `https://sendtoanyone.com/d/...`, and no password appears.
5. Open the link. If the transfer has a password, type it in the page. The email must not contain it.
6. Send the same share to the same recipient again only if you intend to test idempotency. A 409 must not be shown as a second confirmed delivery.
7. Check Resend’s event list for delivered, bounced, or complained. The application has no row for those events.
8. Repeat once from a preview URL only if preview has its own Resend key or sending is disabled there. A preview that uses the production key sends real mail.

Provider acceptance is the API 2xx response. Mailbox delivery is the message in the inbox, including the spam folder. They are different. A bounce or a complaint is visible in Resend only. This app will not suppress the next send by itself.

## Supabase Auth mail

Account mail is separate from Resend transfer mail. Status of the dashboard settings: UNVERIFIED.

The application origin is whatever host the browser is on.

| Flow | Code | What the dashboard must be checked for |
| --- | --- | --- |
| Password reset | `src/lib/authSession.js` `resetPasswordForEmail` sets `redirectTo` to `{window.location.origin}/?action=reset-password` | The redirect allow-list. A wildcard, or a preview origin on that list, can receive the reset link |
| Google sign-in | `signInWithGoogle` sets `redirectTo` to `window.location.origin` | The same allow-list |
| Email confirmation | `AuthModal.jsx` `signUp` does not set `emailRedirectTo` | GoTrue uses the project Site URL when the client omits a redirect. Record that Site URL |

The production origin for transfer links and canonical tags is `https://sendtoanyone.com`. `APP_URL` in `wrangler.jsonc` is that URL. A legacy host in `APP_URL` is rewritten to this origin before a link is written into mail.

Human check, without editing:

1. Open `https://supabase.com/dashboard/project/giyeepztahdbsejsozog/auth/url-configuration` in the `iprudhvi` organization.
2. Record Site URL.
3. Record every Redirect URL. Write whether any entry is a wildcard, `https://itransfer-app.pages.dev`, another `*.pages.dev` host, a `phase5-rate-limit-test` preview URL, or `https://sendtoanyone.com`.
4. Open Authentication → Emails. Record the confirmation redirect and the password-recovery redirect if the page shows them separately from the URL configuration.
5. Compare those URLs with `https://sendtoanyone.com` and `https://sendtoanyone.com/?action=reset-password`.

Do not add or remove a URL in this phase. Do not point Auth SMTP at the transfer Resend key.

## Sending mail and receiving mail

Resend sends. It does not require `sendtoanyone.com` to have MX for outbound API mail. Inbound mail to `send@sendtoanyone.com` will not arrive anywhere, because that domain has no MX. Replies go to the Reply-To address when the sender typed an email. That reply is delivered by the recipient’s mailbox to the sender’s own provider, not to this app.

`iprudhvi.in` already receives mail at iCloud. Leave that path in place. Forwarding, a new mailbox, or an inbound webhook is a separate project and is not configured here.

## Checklist

| Item | Purpose | Verification | Expected | Status | Risk | Dashboard action |
| --- | --- | --- | --- | --- | --- | --- |
| Pages function is the sender | Avoid the legacy SMTP file | Read `functions/api/send-email.js` and the live OPTIONS response | Resend only, with idempotency and hold-on-limit | Verified in the repo and on the public OPTIONS response | Configuring SMTP on Pages does not activate `api/send-email.js` | None |
| From domain | Alignment with a verified domain | Resend domain page. `EMAIL_FROM_ADDRESS` is an encrypted production secret | Chosen domain verified, and From matches it | UNVERIFIED. The secret name is set and its text was not read. Code default applies only when the secret is empty | Unverified From is rejected or spam | Open Resend and the Pages variable screen. Do not add records from memory |
| SPF | Authorize the sender | DNS compared with Resend | One SPF TXT, value pasted from Resend, beside the existing Google TXT | No SPF on `sendtoanyone.com` today | A guessed value or a second SPF fails mail | Required only after the domain is chosen |
| DKIM | Sign the message | DNS compared with Resend | The published `resend._domainkey` TXT matches Resend, or Resend shows a different host to add | TXT exists. Match unverified | A mismatched key fails DKIM | Compare. Do not duplicate |
| DMARC | Policy | Public TXT | Keep `p=none` on `sendtoanyone.com` | Verified in public DNS | `reject` will drop mail that is not yet aligned | No change |
| iCloud records | Protect existing mail | Public MX, SPF, and DMARC on `iprudhvi.in` | Leave them | Verified in public DNS | Editing them breaks the existing mailbox | No change |
| Live test | Separate acceptance from delivery | One message to a controlled mailbox and the Resend event | Inbox arrival, correct link, no password | Not run | A 2xx response can still bounce | Required before calling mail ready |
| Auth redirects | Account mail lands on an approved origin | Supabase Authentication → URL Configuration and Emails for project `giyeepztahdbsejsozog` | Site URL and redirects are the production origin. No wildcard and no preview host | UNVERIFIED | A preview URL on the allow-list can receive a reset or confirmation link | Record the list. Do not edit it |
| Bounces | Stop repeat sends to bad addresses | Resend webhooks and suppressions | A bounce is recorded and the next send is suppressed | Not implemented | The app can keep sending to a bouncing address | Do not invent a webhook URL in this phase |
