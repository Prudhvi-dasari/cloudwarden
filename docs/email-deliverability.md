# SendToAnyone deliverability diagnostic

Read-only investigation on 23 October 2026. Public DNS was queried. No DNS record was added or edited. No email was sent. No API key, webhook secret, DKIM private key, or Pages secret was read. The Resend dashboard was not opened.

The user reports that Resend currently shows `sendtoanyone.com` verified. This document records what public DNS and the repo can confirm. The green badge itself is visible only in the dashboard.

Inbox placement is not proven. A verified domain and an accepted API call do not place a message in the inbox. Placement depends on the sending reputation and on each recipient provider.

## DNS observed

Authoritative queries went to `addyson.ns.cloudflare.com`. The same answers for the mail names below were returned by `1.1.1.1`. Nameservers are `addyson.ns.cloudflare.com` and `rocco.ns.cloudflare.com`.

Google site-verification tokens and the DKIM public key are omitted.

| Name | Type | Observed value |
| --- | --- | --- |
| `sendtoanyone.com` | TXT | One record. It is a Google site-verification TXT. No `v=spf1` TXT on the apex |
| `sendtoanyone.com` | MX | No MX answer |
| `sendtoanyone.com` | A / AAAA | Cloudflare proxy addresses `104.21.4.248`, `172.67.132.167`, `2606:4700:3034::6815:4f8`, `2606:4700:3034::ac43:84a7` |
| `_dmarc.sendtoanyone.com` | TXT | `v=DMARC1; p=none;` |
| `resend._domainkey.sendtoanyone.com` | TXT | One DKIM-style TXT. The value has no `v=DKIM1` tag and starts with `p=`. The base64 key length is 216 characters, which is the size of a 1024-bit RSA public key. The key text is not copied here |
| `send.sendtoanyone.com` | CNAME | `send.forge.rmta.net` |
| `rsend.sendtoanyone.com` | CNAME | `rsend-apne1.forge.rmta.net` |

Following those CNAMEs on a public resolver:

| Target | What it publishes |
| --- | --- |
| `send.forge.rmta.net` | TXT `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all`. MX priority 10, `feedback.forge.rmta.net` |
| `rsend-apne1.forge.rmta.net` | TXT `v=spf1 include:amazonses.com ~all`. MX priority 10, `feedback-smtp.ap-northeast-1.amazonses.com` |

These target records live on the CNAME destination. They are not TXT or MX rows in the `sendtoanyone.com` zone. Do not copy them into the zone and do not replace the CNAMEs with flattened SPF or MX records.

Names queried at the authoritative server with no record (`NXDOMAIN`):

- DKIM selectors other than `resend`: `resend2`, `s1`, `s2`, `selector1`, `selector2`, `google`, `default`, `k1`, each under `_domainkey.sendtoanyone.com`
- `_amazonses.sendtoanyone.com`
- `bounce`, `bounces`, `mail`, `email`, `em`, `links`, `click`, `track`, `open`, `r`, `feedback`, each as a subdomain of `sendtoanyone.com`
- `default._bimi.sendtoanyone.com`
- `www.sendtoanyone.com`

No CAA record was present at the apex. The repo docs name only the `resend._domainkey` selector. No other selector is referenced there.

`iprudhvi.in` is a separate mailbox domain on iCloud. This pass did not change it and it is not the code’s default From domain.

## What this verifies

Public DNS confirms a sending-domain shape that matches Resend’s current return-path pair (`send` and `rsend` CNAMEs) plus a DKIM TXT at `resend._domainkey`.

| Check | Result from this pass |
| --- | --- |
| DKIM public record on `sendtoanyone.com` | Published at `resend._domainkey` as a TXT. Match to the dashboard key is unverified, because the key was not compared |
| SPF for the return path | Published on the CNAME targets, not on the apex. `send` authorizes three IPv4 mechanisms. `rsend` authorizes `include:amazonses.com`. Both use `~all` |
| Bounce MX for the return path | Present on the CNAME targets. The `rsend` MX host is `feedback-smtp.ap-northeast-1.amazonses.com`, which is Resend’s documented SES return-path host for `ap-northeast-1` |
| DMARC policy | Published. Policy is `p=none`. No `rua`, no `ruf`, no explicit `adkim` or `aspf` (the spec default for both is relaxed) |
| Receiving mail at `@sendtoanyone.com` | Not configured in public DNS. The apex has no MX. The MX records behind `send` and `rsend` are the outbound return path. They do not accept mail for `send@sendtoanyone.com` |
| Resend “verified” badge | Reported by the user. Not visible from DNS. DNS cannot show `verified` versus `partially_verified`, and it cannot show each record’s status in the Resend Records tab |
| Live From address | Unverified. The code default is `SendToAnyone <send@sendtoanyone.com>` only when `EMAIL_FROM_ADDRESS` is empty. Production has that name set as an encrypted Pages secret. The value was not read |
| A real message passed SPF, DKIM, and DMARC | Unverified. No message was sent and no `Authentication-Results` header was inspected |
| Inbox, spam, bounce, or deferral | Unverified |

A green dashboard is compatible with these records existing. It is still a dashboard fact. This DNS read does not see it.

## DMARC stays at p=none

Leave `_dmarc.sendtoanyone.com` at `v=DMARC1; p=none;`.

Alignment is not proven, and other legitimate senders are not identified:

- No received message shows `dmarc=pass`.
- The production From value was not read. If that secret uses a domain other than `sendtoanyone.com`, the records above do not authenticate the live mail.
- There is no `rua`, so there is no aggregate-report history.
- The only DKIM selector found is `resend`. Absence of other selectors is not a list of every system that might send with this domain. Supabase Auth mail is a separate path and its SMTP settings were not opened.
- `sendtoanyone.com` has no MX, so a report address on this domain would have nowhere to arrive.

A later policy change waits until a received test shows aligned SPF and DKIM, the From secret is known to be on this domain, and every other sender has been identified from reports. That work is outside this pass. Do not move the policy to `quarantine` or `reject`.

## What the app can see

Production mail is `functions/api/send-email.js`, which calls `deliverTransferMail` in `functions/lib/mailService.js`. That posts once per recipient to `https://api.resend.com/emails` through `functions/lib/resendMail.js`.

The JSON body contains `from`, `to`, `subject`, `text`, `html` when present, and `reply_to` when present. The `Idempotency-Key` header is a hash of the share id and recipient. The body does not set tags, custom headers, or a tracking flag.

On HTTP 2xx, `createResendAdapter` reads `id` from the JSON and stores it as `providerId`. `deliverTransferMail` counts the acceptance and then drops that id. The response to the browser is `success: true`, `status: "accepted"`, `delivery: "unconfirmed"`, `provider: "resend"`, plus counts. It has no provider message id.

`src/lib/emailStatus.js` shows “Accepted” for that shape, with the summary that delivery is not confirmed. The “Delivered” label requires `status: "delivered"` and `delivery: "confirmed"`. The send path never sets those fields.

The ops log line for a full acceptance is JSON with `event: "email"`, `result: "provider_accepted"`, `category: "UNCONFIRMED_DELIVERY"`, `count`, and `durationMs`. The logger only keeps short tokens, so it cannot store a Resend id.

There is no webhook route under `functions/api/`. The routes there are `send-email.js`, `dodo.js`, `drive.js`, `geo.js`, `payment.js`, and `r2.js`. Nothing in the repo verifies an `svix-id`, `svix-timestamp`, or `svix-signature` header. Nothing stores bounces, complaints, deferrals, or suppressions.

A 2xx from `https://api.resend.com/emails` means Resend accepted the API request. It does not mean delivered, bounced, deferred, complained, or suppressed.

| Resend fact | What it means | What this app stores |
| --- | --- | --- |
| API 2xx and an email id | Accepted for sending | Acceptance only. The id is discarded |
| `email.sent` | Resend handed the message toward delivery | Nothing |
| `email.delivered` | The recipient’s mail server accepted it | Nothing. This is still not the inbox |
| `email.delivery_delayed` | A temporary deferral. Resend retries | Nothing |
| `email.bounced` | The recipient server rejected it | Nothing. The next send is not suppressed by this app |
| `email.complained` | The recipient reported spam | Nothing |
| `email.failed` | Resend could not send it | Nothing, unless the API call itself returned a non-2xx, which becomes `rejected` or `unavailable` |
| Suppressions list | Resend will not deliver to that address | Nothing in this repo |

`api/send-email.js` at the repo root is a legacy handler. The Pages function is `functions/api/send-email.js`.

## Diagnostic workflow

Use one genuine transfer to a mailbox you control. Record the fields below. Leave recipient addresses and message bodies out of git.

1. Provider message id. The app does not return it. In Resend, open Emails and match the time, subject, and recipient of that transfer. Copy the email id from that row. That id is the provider message id. The RFC `Message-ID` is a different field on the event payload.
2. Sanitized app response. Keep `status`, `delivery`, `provider`, `dispatchedCount`, `uncertainCount`, and `reason`. For a normal success those are `accepted`, `unconfirmed`, `resend`, the recipient count, `0`, and no reason. The ops line `provider_accepted` / `UNCONFIRMED_DELIVERY` is the same fact. `fallback` means Resend was not called.
3. Resend event status. On that email id, record the latest event: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, or `email.failed`. `email.delivered` means the destination server accepted the message.
4. Destination provider. Use the recipient domain: Google for Gmail, Microsoft for Outlook, Hotmail, and Live, Apple for iCloud. The delivered event names that provider’s mail server. It does not name the folder.
5. Folder or failure. In the mailbox, record inbox, spam, or absent. A bounce is the `email.bounced` event, not a folder. A deferral is `email.delivery_delayed`. A complaint is `email.complained`. Check the Suppressions list before retrying a bounced address.
6. Authentication on a message that arrived. From the message source, record `Authentication-Results` for SPF, DKIM, and DMARC. That header is the evidence of alignment. DNS records alone are not.

Repeat that sheet once for Gmail, once for Microsoft, and once for Apple before treating any provider as healthy. One inbox does not speak for the others.

## Sender, links, and tracking

| Item | What the code does | Recommendation |
| --- | --- | --- |
| From display name | Default `SendToAnyone <send@sendtoanyone.com>`. The visible brand in the templates is SendToAnyone | Keep that name. Confirm the Pages secret matches it, including the `sendtoanyone.com` domain. Do that in the dashboard. Do not print the secret |
| Reply-To | The typed sender address when it is an email. Otherwise `EMAIL_REPLY_TO` when that variable is an email. Otherwise omitted | Reply-To is the person who should receive the reply. It is expected to be a different domain from From. DMARC uses From. `EMAIL_REPLY_TO` has to be a mailbox that can receive mail. `send@sendtoanyone.com` has no MX, so it cannot be that mailbox |
| Visible links | `applicationOrigin` reads `APP_URL`, then rewrites `itransfer.iprudhvi.in` and `www.sendtoanyone.com` to `https://sendtoanyone.com`. `wrangler.jsonc` sets `https://sendtoanyone.com` | Download and footer links use `https://sendtoanyone.com` |
| Plain text | Every event type sets `text` and `html`. The adapter sends both | Plain text is already present. Template markup is owned by the template pass |
| Open and click tracking | The send payload does not enable tracking. Templates in `mailService.js` contain no tracking pixel. Resend’s own docs say open and click tracking are off until the domain setting is enabled and a tracking subdomain is verified. No CNAME was found at `links`, `click`, `track`, or `open` | Leave tracking off for this transactional domain. The code has no per-message switch, so the control is the domain Configuration tab. Do not add a tracking CNAME. Open tracking is a marketing signal and is a poor fit for transfer mail and for any future auth mail sent through this domain. Account mail today is Supabase Auth, not this Resend call. Its SMTP settings were not opened |

## Gradual sending

Send only mail a person just asked for by completing a transfer.

1. Send one small transfer to your own Gmail, one to your own Microsoft mailbox, and one to your own Apple mailbox.
2. For each, fill in the diagnostic sheet above before sending another.
3. After those three show `email.delivered`, and you have seen which folder each provider used, continue with the product’s ordinary volume: a person completes a transfer and names a recipient.
4. Stay well below the provider’s daily ceiling. The pricing note already in `docs/production-readiness/current-limits.md` is the ceiling to respect, not a target to approach.
5. On `email.bounced` or `email.complained`, stop and read that event before any further send to the same domain.

Do not buy a list. Do not send to people who did not request the transfer. Do not generate fake opens or clicks. Do not rotate domains. Do not try to evade a spam filter. Those practices are out of scope for this product and would damage the domain.

## Resend dashboard checklist

These items are not decidable from the repo or from public DNS. Record the answers. Do not change DMARC. Do not add an apex SPF. Do not paste secrets into this file.

| Check | Where | What to write down |
| --- | --- | --- |
| Domain status | Domains → `sendtoanyone.com` | `verified`, `partially_verified`, or another status. The user reports green. Record the exact word on the page |
| Per-record status | The Records tab | Status of the DKIM TXT, the `send` CNAME, and the `rsend` CNAME. Write whether any row is still pending |
| Region | Domain details | The region name. Public DNS shows the fallback MX in `ap-northeast-1`. The dashboard is the source for the configured region |
| Capabilities | Domain details | Sending and receiving, each enabled or disabled. Public DNS shows no apex MX |
| DKIM match | Records tab, compared with DNS, without copying the key into git | Whether the published `p=` value is the one on the page. If it matches, add nothing |
| Apex SPF | Records tab | Whether Resend asks for a TXT on the apex. The zone has no apex SPF today. Add one only if that page lists it, as its own TXT, beside the Google verification TXT |
| Tracking | Configuration → tracking metrics | Open tracking off, click tracking off, and no tracking subdomain. If a subdomain is listed, write its exact name. Leave tracking off |
| Recent From | Emails → a recent message | The From address, including the display name. It should be `SendToAnyone <send@sendtoanyone.com>` unless the Pages secret intentionally uses another address on this verified domain |
| Pages `EMAIL_FROM_ADDRESS` | Cloudflare Pages → `itransfer-app` → production variables | Whether the value is the default above. View it in the dashboard. Do not print it into a log or a doc |
| `EMAIL_REPLY_TO` | The same variables screen | The address, if set, and that its domain has a real mailbox. Do not point it at `send@sendtoanyone.com` |
| Webhooks | Webhooks | Whether any endpoint exists. This repo has none. Do not create an endpoint in this incident. A later endpoint needs its own change, a signing secret stored as a Pages secret, and verification of `svix-id`, `svix-timestamp`, and `svix-signature` over the raw body. Subscribe that future route to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, and `email.failed` |
| Suppressions | Suppressions | Whether the test recipient is listed. A listed address will not be delivered |
| One live test | Emails, after a transfer you initiated | The email id, the latest event, and the folder in that mailbox. That is the first real delivery evidence, and it applies to that provider only |
| Supabase Auth | Authentication → SMTP and email templates for project `giyeepztahdbsejsozog` | Whether account mail uses Resend or Supabase’s own mail. Leave it unchanged in this pass |

## Webhook setup, when a route exists

No route exists now, and this pass does not add one. When a route is added later:

- Create the webhook in the Resend dashboard only after the URL is deployed.
- Save the signing secret as a Pages secret. Do not commit it and do not invent a value.
- Verify the Svix signature on the raw request body using `svix-id`, `svix-timestamp`, and `svix-signature`. Reject a failed verification before reading the event as real.
- Treat `email.delivered` as mail-server acceptance. The inbox is still a separate observation.
- Store the email id. The current send path throws that id away, so the app cannot join an event to a transfer until a later change keeps it.

## Related notes

`docs/production-readiness/email-configuration-checklist.md` records an earlier same-day read: DKIM TXT present, apex SPF absent, DMARC `p=none`. That apex description is still true. This pass also found the `send` and `rsend` CNAMEs, which that checklist does not list. Use this file for the return-path records.
