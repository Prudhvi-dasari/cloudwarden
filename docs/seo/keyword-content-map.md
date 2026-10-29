# Keyword and content map for SendToAnyone

Access date: Friday 23 October 2026. Competitor figures and conflicts are in `docs/seo/competitor-research.md`. This map does not add a URL for every keyword. The thin routes in `SEO_KEYS` (`src/App.jsx`) already share one template, `src/pages/SeoLandingPage.jsx`. Improving that template twenty times would still be twenty doorways.

People-first test: a stranger who will never send a file should still learn the limit, the expiry, and what the password does not do. No scaled variants, no “best tools of 2026” list, no borrowed headings.

Product bounds for every page: 6 GB per transfer (`6_000_000_000` bytes), link life from 1 hour to 7 days, no account required to send, no longer retention, no paid plan. The repository’s 1 TB cap is the whole platform, not a user quota. Do not advertise it.

## Six pages to improve

No new route. Each row is one intent.

### 1. Send a large file now

- **Intent:** Transactional. The person wants to move a file that will not fit in email, and they want the limit before they start.
- **Route:** `/send-large-files` (exists).
- **Distinct value:** State 6 GB per transfer, 1 hour to 7 days, no account, folder selection, and that the app uploads the file as chosen rather than transcoding it. Say what does not fit: anything over 6 GB, and any need to keep the link past 7 days. A short subsection can cover a video, a design source file, or a folder, because those are the same ceiling and the same expiry. The useful extra is practical: a project folder can be selected (`src/components/DropZone.jsx`); a file over 6 GB has to be split, because there is no larger plan (`src/pages/PricingPage.jsx`).
- **Already addressed:** `src/pages/SeoLandingPage.jsx` for this key, plus the real form on `src/pages/HomePage.jsx` at `/`. The landing is a thin restatement. The homepage already has the honest limits.
- **Action:** Improve `/send-large-files` so it is a useful front door onto the form. Do not keep a second thin page for the same send.

### 2. Send without creating an account

- **Intent:** Transactional. The person has been asked to sign up, or they do not want the recipient to sign up, and they want to know which side actually needs an account.
- **Route:** `/send-files-without-signup` (exists).
- **Distinct value:** Say that the sender does not need an account, and the recipient does not either. Say what “no account” does not mean: the link is still a URL anyone who has it can open, unless a password is added; email is optional and only carries the link. WeTransfer’s free-plan article fetched on 23 October 2026 says sending requires a free WeTransfer account and receiving does not. That contrast belongs here, with the date and the URL, not as a slogan.
- **Already addressed:** `src/pages/SeoLandingPage.jsx` key `send-files-without-signup`. Homepage and `src/pages/PricingPage.jsx` already say an account is not required to send.
- **Action:** Improve this route. Do not create another “free” or “no registration” URL.

### 3. Put a password on the download

- **Intent:** Informational, with a direct next step. The person wants a link that does not open for everyone who receives it.
- **Route:** `/security` (exists). Do not add `/password-protected-file-sharing` or any similar slug.
- **Distinct value:** The password is optional, it is checked as a SHA-256 hash (`functions/lib/transferSecurity.js`, `passwordMatches`), and the download page waits until it matches. The notification email does not include the password (`functions/lib/emailTemplates.js`). The security page already says this is a gate, not zero-knowledge end-to-end encryption. Add the practical part competitors explain and this page does not yet spell out: choose the password in the send form, give it to the recipient on a different channel, and know that a person who has both the link and the password can download. Losing the password does not make the file unreadable to the service, because the password does not encrypt the file.
- **Already addressed:** `src/pages/SecurityPage.jsx` at `/security`, the toggle on `src/pages/HomePage.jsx`, and the homepage FAQ. Features mentions sending controls but `/security` is the page that should own this question.
- **Action:** Improve `/security`. Mention the same fact in one sentence on the large-file page. Do not create a password landing.

### 4. Ask someone else to upload

- **Intent:** Transactional. The person needs files from a client or a teammate and does not want to make them create an account.
- **Route:** `/receive` (exists). This is the tool. `/request/:requestId` is the link they share.
- **Distinct value:** How to create the request, what the other person sees, the 6 GB ceiling on what they upload, and that the request link lasts 7 days (`docs/production-readiness/current-limits.md` clamps file-request retention to 168 hours). The form already accepts a title (120 characters) and instructions (500 characters) in `src/pages/FileRequestPage.jsx`. Smash’s fetched free page says a personalized drop-off link is paid. TransferNow’s fetched free column includes an email request and a deposit link, and reserves the website widget for paid plans. SendToAnyone can describe the request it actually has, and should not describe a branded widget or a permanent portal.
- **Already addressed:** `src/pages/FileRequestPage.jsx` at `/receive`. A second, thin page exists at `/file-request` via `SeoLandingPage`.
- **Action:** Improve `/receive`. Make `/file-request` a near-duplicate: one canonical, `/receive`. Do not write a second request article.

### 5. Decide how to send a large file

- **Intent:** Informational. The person wants a procedure, not a product adjective: attachment versus link, what fits in 6 GB, what to do when it does not.
- **Route:** `/how-to-send-large-files` (exists).
- **Distinct value:** A short procedure. Mail attachments are commonly rejected around 20–25 MB (SwissTransfer’s homepage uses that range as the reason a link exists; do not present it as a measured test of Gmail). Upload on SendToAnyone, copy the link or email the link, set an expiry inside 7 days, and optionally set a password that you deliver separately. If the project is over 6 GB, split it. There is no upgrade that raises the cap. If both people are on the same network and the file should not be stored, use `/qr-transfer` instead, and still respect 6 GB. After download, compare hashes at `/checksum`. Video, folders, and “do not compress it” belong as paragraphs here or on `/send-large-files`, not as extra URLs. The advice that differs from a generic large-file paragraph is only: original bytes are uploaded, a folder can be selected, and a master file over 6 GB does not fit in one transfer.
- **Already addressed:** `src/pages/SeoLandingPage.jsx` key `how-to-send-large-files`, and a product walkthrough at `/how-it-works` (`src/pages/HowItWorksPage.jsx`).
- **Action:** Improve `/how-to-send-large-files` into the practical guide. Leave `/how-it-works` as the product walkthrough. Do not add a third explainer. Do not repeat the How it works line that says files are client-encrypted before upload. That conflicts with `/security`.

### 6. Compare this with the usual options

- **Intent:** Comparison. The person is choosing among transfer tools and wants limits they can check, including where SendToAnyone is worse.
- **Route:** `/compare` (exists). `/vs-wetransfer` and `/vs-transfernow` already render `src/pages/ComparePage.jsx`. Keep them as aliases of this page.
- **Distinct value:** A dated table. SendToAnyone: 6 GB, no account to send, password is a download gate, 7 days maximum, same-network transfer, checksum, no public API, no paid tier. Other cells only from the fetched pages in the research note. Where WeTransfer’s help center and its resource articles disagree (3 GB total versus 3 GB per transfer, 1 TB versus “no size cap,” password on Ultimate versus password on free), print “sources disagree” and link both URLs. SwissTransfer is 50 GB on the pages fetched, with a 30-day versus 60-day conflict that must stay visible. Smash must not be reduced to “unlimited.” TransferNow free is 5 GB, 7 days, and the pricing page includes a password without an account. Say plainly that SendToAnyone is smaller than SwissTransfer’s free 50 GB and shorter than paid retention elsewhere.
- **Already addressed:** `src/pages/ComparePage.jsx`. Its current rows say WeTransfer free is 2 GB and that WeTransfer and TransferNow passwords are paid-only. Those rows do not match the pages fetched on 23 October 2026.
- **Action:** Improve `/compare`. Do not create a “best WeTransfer alternative” article, an India doorway, or a 2026 roundup.

## Video and project files

`/send-large-video` is the same intent as `/send-large-files`: send a big file under the same cap. A video-only twin will not teach a different limit, expiry, or password. Improve `/send-large-files` (and the guide, for the over-6 GB case). Do not keep `/send-large-video` as its own page.

## File-request canonical

`/receive` is the canonical file-request URL. `/file-request` is the thin landing. One page.

## Variants that must not get their own page

| Query family | Existing thin route | Single page that should answer it |
| --- | --- | --- |
| iPhone to Windows, Android to Mac, phone to laptop, AirDrop alternative, P2P | `/iphone-to-windows`, `/android-to-mac`, `/phone-to-laptop`, `/airdrop-alternative`, `/p2p-file-transfer` | `/qr-transfer` |
| Best WeTransfer alternative, including India | `/wetransfer-alternative`, `/transfernow-alternative`, `/best-wetransfer-alternative-india` | `/compare` |
| WhatsApp | `/send-files-whatsapp` | `/send-large-files` |
| Without compression | `/send-files-without-compression` | `/send-large-files` |
| File transfer free | `/file-transfer-free` | `/send-large-files` |
| Large video | `/send-large-video` | `/send-large-files` |
| Send a folder | `/send-folder-online` | `/send-large-files` |
| Send by email | `/send-files-by-email` | `/how-to-send-large-files` |
| Create a sharing link | `/create-file-sharing-link` | `/send-large-files` |
| Expiring link | `/expire-file-link` | `/how-to-send-large-files` |
| File request (thin) | `/file-request` | `/receive` |

Device pages are one intent: get a file from this phone to that computer without a store account. `/qr-transfer` is the real flow. It must say same-network, nothing stored, 6 GB still applies, and it must not call itself AirDrop.

WhatsApp, “free,” and “without compression” are people trying to send a large file as-is. There is no WhatsApp integration. The link is pasted into the chat. The file is uploaded as selected. That is the large-file page.

“Free transfer” is not a second product. Free is the only plan.

Email and expiry are decisions inside the guide: the message contains a link, and the sender picks a time up to 7 days.

## Claims that are unsafe until a feature exists

Do not put these on any of the six pages:

- 1 TB per user, or any user storage quota. The platform cap is operational and is not a launched public limit.
- End-to-end encryption, zero-knowledge encryption, or “the password encrypts the file.”
- The How it works wording that files are client-encrypted before they are streamed.
- Virus or malware scanning. Executable types are blocked. That is the claim that exists.
- A numbered upload or download speed, a resume guarantee, or “TUS” as a public promise. The landing copy mentions chunked TUS and auto-resume. This map does not treat that copy as verified product language for SEO.
- “Instant” or guaranteed email delivery. Acceptance by the mail provider is not delivery.
- Paid plans, Pro, Teams, SSO, a custom domain, branded download pages, or recovery of an expired transfer. Pricing says Pro and Teams cannot be purchased.
- A public API, SDK, CLI, desktop app, or Outlook/Gmail add-in. Apps says those are absent. The API docs page shows sample calls for an API the compare page says is not offered.
- GDPR compliance, a DPA, regional data residency, or “guaranteed privacy,” including the assertions on `src/pages/CompliancePage.jsx`. They were not confirmed as implemented.
- Download presets of 1, 5, or 10. The counter exists; those presets are not what the send form shows.
- “ZIP of the whole transfer” and “nested structure preserved” as marquee lines, beyond the homepage FAQ, until the download path is checked. Folder selection itself is in the product.
- AirDrop, iCloud, or WhatsApp as if they were features of this product.
- Any competitor limit written as a single number where the research note records a conflict.

## What not to add

No new URL for password sharing, creative-project files, India, WhatsApp, device pairs, “without compression,” or “file transfer free.” No best-of list. Checksum and QR stay the tools they already are: `/checksum` and `/qr-transfer`.
