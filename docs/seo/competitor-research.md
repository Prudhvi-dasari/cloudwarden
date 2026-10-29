# Competitor research for SendToAnyone

Access date: Friday 23 October 2026.

## Method

Official public pages were opened with web fetch, and web search was used to find those URLs. A claim is **verified** only when the page body loaded on this date. A **search snippet** is not treated as the page. If a fetch returned a title, an error, or a partial body, that is stated and the missing part is not filled in.

**Legend**

- **Verified:** the URL below returned the statement on 23 October 2026.
- **Conflict:** two verified pages disagree. Neither number is chosen as the truth.
- **Not opened:** the URL was not fetched, or the fetch did not include that fact.
- **Product fact:** read in this repository. These are SendToAnyone facts, not competitor facts.

SendToAnyone facts used below: free cloud transfers are 6 GB per transfer (`6_000_000_000` bytes), links last from 1 hour to 7 days, no account is required to send, and a password can gate the download. The 1 TB figure in the repo is a whole-platform operational cap, not a user quota, and it is not a public limit. Pro and Teams are not for sale (`src/pages/PricingPage.jsx`).

## TransferNow

Official site verified: `https://www.transfernow.net`.

**Pages opened**

- Pricing and plan comparison: `https://www.transfernow.net/en/prices`
- Free plan: `https://www.transfernow.net/en/discover/transfernow-free-forever`
- Security: `https://www.transfernow.net/en/explore/security`
- Support, maximum size (updated on the page as 10/02/2025): `https://support.transfernow.net/en/article/what-is-the-maximum-size-of-a-transfer-1vjb64a/`

**Topics they answer in public**

Large-file sending, sending with no account, email or link, password on a download, file requests and deposit links, 7-day free retention, paid size and storage, antivirus, TLS and AES, SSE-C on paid plans, recovery of expired transfers on paid plans, apps and mail add-ins, region choice, and a GDPR claim on the security page.

**Verified limits and wording**

- Free: 5 GB per transfer, files available 7 days, no sign-up, password protection included, email or link, request files by email, deposit links. No storage on the free row. The support article repeats 5 GB for the free version.
- Premium, as priced on the page: 250 GB per transfer, up to 365 days, 1 TB of account storage, SSE-C, recover expired transfers. Team: 500 GB per transfer, 2 TB shared, 10 users. Enterprise: custom size, availability, and storage. A Starter line on the same pricing page says 10 GB per transfer, 100 GB of storage, 30 days, and 3 €/month on the two-year price shown.
- Password on the free landing is described as protecting download access, with no account required. The security page separates that access password from paid SSE-C, where they say they do not store the key.
- The pricing FAQ also says that a download password encrypts the files and that a lost password makes the files technically irrecoverable. That sentence conflicts with the security page, which reserves “even we cannot access your files” for paid SSE-C. Both sentences were on fetched pages. Do not treat TransferNow’s password as end-to-end encryption on the strength of one FAQ.
- The comparison table lists antivirus, SSL/TLS, and AES-256 on the free column.

**What they answer well**

A single pricing table that says what is absent on the free plan (no storage, no download tracking, no custom expiry, no widget). The free landing is specific about 5 GB, 7 days, and password without an account.

**Not verified**

A guide or comparison library was not opened. Upload speeds were not stated as numbers on the pages fetched. Whether the free password really encrypts bytes, or only gates access, is unresolved because their own pages conflict.

## WeTransfer

Official site verified: `https://wetransfer.com`.

**Pages opened**

- Plan limits: `https://wetransfer.com/help-center/subscriptions/plan-limits`
- Free plan article: `https://wetransfer.com/resources/free-file-transfer/wetransfer-free-plan`
- File size article: `https://wetransfer.com/resources/free-file-transfer/wetransfer-file-size-limit`
- Password article: `https://wetransfer.com/resources/password-protected-file-transfer/how-to-password-protect-file-sharing`
- Resources index: `https://wetransfer.com/resources` (partial; see failures)

**Topics visible on the pages that loaded**

Free versus paid limits, file size, password and email-restricted access, sending without the recipient creating an account, no recompression, folders, expiry, and recovery as a paid reason to upgrade. The resources index showed shortcuts for large files, free transfer, a download link, multiple files, recovering expired files, and branded transfers, then reported that part of the page failed to load. A full topic catalogue was not retrieved.

**Verified limits, including conflicts**

- Help center: Free is “up to 10 transfers (or 3 GB total) in any 30-day rolling window.” Starter is 10 transfers or 300 GB total in that window. Ultimate and above: “unlimited transfers up to 1 TB per transfer,” and the same sentence lists custom expiration, password protection, branded pages, and Access Control. Default storage “up to 2 TB,” covering live and recoverable transfers. Teams up to 5 TB. The page says upload and download speed do not differ by plan.
- Free-plan article: free accounts “allow up to 10 transfers and up to 3 GB of total usage per rolling 30-day window, and transfer links expire after a maximum of 3 days.” Sending requires a free account. Recipients do not. Password and an email allow-list are described as included on every plan, including free. Up to 10 email recipients per transfer.
- File-size article: “Free accounts let you send up to 3 GB per transfer.” It also says Ultimate “removes the per-transfer size cap entirely.” That conflicts with the help center’s 1 TB Ultimate cap. The same article says files are not recompressed, and that a folder upload keeps its structure.
- Password article: password is “included on every WeTransfer plan, including the free tier,” is not put in the notification email, and can be changed after send. This conflicts with the help-center overview, which names password protection inside the Ultimate feature list and does not say free includes it.

Do not publish a single WeTransfer free size, expiry, or password rule until those pages are reconciled. The current `/compare` row that says WeTransfer free size is 2 GB, and that a password is paid-only, does not match the pages fetched on this date.

**What they answer well**

The help center explains the rolling 30-day window with an example. The free-plan article is clear that the sender needs an account and the recipient does not.

**Not verified**

`https://wetransfer.com/pricing` returned only the title “Pricing | WeTransfer - Send Large Files & Share Photos Online.” No price or limit was readable there. Several resource pages ended with a notice that some parts of the site did not load; the article text above that notice is what this note uses. Encryption strength and malware scanning were marketing lines on the resource templates (“file encryption,” “malware scanning” on Ultimate in the size article). They were not opened as a security specification.

## SwissTransfer

Product host verified: `https://swisstransfer.com/`. Infomaniak’s product page is `https://www.infomaniak.com/en/swisstransfer`.

**Pages opened**

- `https://swisstransfer.com/`
- `https://www.infomaniak.com/en/swisstransfer`
- Limits FAQ, page date “Update 10/22/2026”: `https://www.infomaniak.com/en/support/faq/2929/understanding-swisstransfer-data-limits`

**Topics they answer in public**

Size, retention, no account, password, a download count, email or link, Switzerland hosting, encryption wording that explicitly is not end-to-end, no AI training, mobile apps, and why this is not an archive. The product homepage also answers video, RAW, design files, folders, and the difference between a link and an email attachment.

**Verified limits, including conflicts**

- `swisstransfer.com`: 50 GB per transfer, combined. Maximum availability 30 days. No account to send or receive. Optional password, sent on a separate channel. A download maximum can be set; the homepage does not list the allowed counts. Encryption “in transit (TLS and AES-GCM) and at rest (LUKS and AES-256). This is not end-to-end encryption.” Files are not converted or compressed. If 30 days is chosen, an email on day 12 invites the sender to extend through day 30. Creating a transfer “is not available from a number of countries outside Europe.” Receiving is described as unrestricted. “Download all” builds a zip.
- Infomaniak FAQ 2929: up to 50 GB. Availability choices listed as 1, 3, 7, 15, or 30 days, plus 60 days on Enterprise. Choosing 30 days deletes the files after 15 days unless the sender confirms an email offered on day 12. Download caps listed as 1, 20, 100, 250, or unlimited on a paid plan. A “Download all” zip over 10 GB must be downloaded file by file.
- Infomaniak product page: the feature card says “Available for up to 60 days,” while the FAQ on that same page says 1 to 30 days, or 60 on Enterprise, and up to 250 free downloads. It also says the first send from a new device asks for an email verification, which is a step the `swisstransfer.com` “no account” line does not mention.

The 50 GB free size is consistent. The 30-day versus 60-day story is not. Quote the page you mean, and do not collapse it into one retention number.

**What they answer well**

`swisstransfer.com` says, in plain language, that storage encryption is not end-to-end encryption, that expired files cannot be restored, and that a transfer service is the wrong tool for an archive. That is the standard SendToAnyone’s own security page should keep.

**Not verified**

The SwissTransfer terms URL that appeared in search (`welcome.infomaniak.com` CGU component) was not fetched. Search text mentioned 20 recipients, 5,000 files, and 5 transfers per hour per IP. Those figures are not used here.

## Smash

Official site verified: `https://fromsmash.com`.

**Pages opened**

- Free plan: `https://fromsmash.com/discover-smash/everyone`
- Pricing: `https://fromsmash.com/pricing`
- Size help, written 27 February 2026: `https://fromsmash.com/help/articles/13885610-what-is-the-file-size-limit-on-smash`

**Topics they answer in public**

No-account sending, email or link, 7-day free availability, a queue for large free transfers, password, paid branding, paid file reception, region-of-hosting marketing, and a statement that files are not used to train AI models.

**Verified limits, including conflicts**

- Free landing: “no size limit and no account required,” and “Beyond 2 GB, transfers aren't prioritized (queued).” Availability “for 7 days.” Password can be added. Personalized drop-off links are reserved for Pro, Team, and Enterprise. The same page’s plan card says “2 GB per transfer” with the queue asterisk.
- Help article: free “there is no file size limit,” with a queue above 2 GB. Paid: “250 GB per transfer with Smash Pro, and 1 TB per transfer with Smash Team.”
- Pricing page: free card “2 GB per transfer” and 7 days, with the same queue note. Pro, Team, and Enterprise bullets say “Unlimited transfer size” and “Transfers valid for 30 days.” The comparison table’s size row, as fetched, only rendered “2 GB*” and did not render the paid size cells. Password-protected transfers, antivirus, and “SSL/TLS and 256-bit AES” appear as security rows; the fetch did not show which plan column includes each row.

Do not quote Smash as either “unlimited” or “2 GB” alone. Say that their free pages advertise no hard cap and also a non-priority queue past 2 GB, and that the paid size on the February 2026 help article (250 GB / 1 TB) conflicts with “unlimited” on the pricing bullets.

**What they answer well**

They explain the queue instead of hiding it: files over 2 GB on the free plan wait behind paid transfers. File reception is clearly paid.

**Not verified**

A recipient-account FAQ from search (`faq.fromsmash.com`, last updated June 2021 in the snippet) was not fetched. Whether free includes antivirus was not readable as a yes or no in the pricing table extract.

## Wormhole

Official site verified: `https://wormhole.app`.

**Pages opened**

- FAQ: `https://wormhole.app/faq`
- Roadmap: `https://wormhole.app/roadmap`

**Topics they answer in public**

End-to-end encryption, a 24-hour server copy, peer-to-peer for larger files, QR codes, and a public roadmap that still lists password protection and file requests as future work.

**Verified limits, including a conflict**

- FAQ: files up to 5 GB are stored for 24 hours. Files larger than 5 GB use peer-to-peer transfer and the sender must keep the page open until the recipient downloads. Files are encrypted with 128-bit AES-GCM in the browser before they leave. “Files are permanently deleted from the server after 24 hours.”
- Roadmap, shipped: QR codes, custom expiration, a maximum download count, inline viewing, delete-before-expiry. Roadmap, future: optional password protection, file requests, “Peer-to-peer Mode,” upload resumption, Wormhole Pro for longer expiry and larger files.

The FAQ’s “larger than 5 GB is peer-to-peer” line and the roadmap’s “peer-to-peer mode is future” line were both on fetched pages. Custom expiration is marked shipped, while the FAQ still states a 24-hour server deletion. The exact custom expiry choices were not on the FAQ.

**What they answer well**

A short explanation that the server cannot read the file, and a concrete rule for when the tab must stay open.

**Not verified**

`https://wormhole.app/security` appeared in search with a description of the key living in the URL fragment. That page was not fetched, so the fragment-key design is not recorded as verified here. The FAQ’s encryption summary is verified.

## Filemail

**Page opened**

- Free service help, dated 16 February 2026: `https://support.filemail.com/en/articles/4103694-free-file-sharing-service`

**Verified**

No registration required. Up to 5 GB per transfer. Up to 2 transfers in 24 hours. Stored for a maximum of 7 days, then deleted. Paid ceilings on that article: Personal 5 GB per transfer, Pro 250 GB, Business and Enterprise “unlimited file size.” “The free service is not available in certain regions.” The article does not name the regions.

**Not opened**

`https://www.filemail.com/plans/basic` and `https://www.filemail.com/large-file-transfer` were search results only. Download counts, recipient caps, and storage quotas from those snippets are not used. Password wording was not on the help article that loaded.

## Dropbox Transfer

**Page opened**

- Overview, “Updated Sep 24, 2026”: `https://help.dropbox.com/share/dropbox-transfer`

**Verified**

Dropbox Transfer is “available to all Dropbox users,” so sending sits inside a Dropbox account. The recipient does not need a Dropbox account. Size: Basic 2 GB; Family and Plus 50 GB; Transfer, Standard, Professional, Education, Essentials, Advanced, and Business 100 GB; Business Plus and Enterprise 250 GB. Replay add-on: up to 250 GB. Expiry: Basic, Family, and Plus are 7 days. The higher plans listed can set a custom date, otherwise 30 days. Deletion after expiry: 30 days later on Basic, Family, and Plus; 180 days later on the higher plans named. Password, logo, and background are described as customization for Standard, Professional, Education, Essentials, Business, Business Plus, Advanced, and Enterprise. The article does not say Basic includes a password.

**Not opened**

`https://help.dropbox.com/plans/dropbox-transfer-plan` was a search result only. No price was fetched.

This is a weak comparison for “send with no account.” It is a useful comparison for “the other person does not need an account” and for 7-day expiry on the free Dropbox plan.

## Google Drive

**Page opened**

- `https://support.google.com/drive/answer/37603`

**Verified**

Stored file caps inside Drive, not a guest transfer flow. “All other files: up to 5 TB.” Google Docs, Sheets, and Slides have their own smaller conversion caps. Any file type can be stored. Preview is described as a scaled-down view.

**Not opened**

No sharing-link, expiry, or “anyone with the link” article was fetched. Do not invent a Drive link lifetime or a no-account send flow from this page. Drive is account storage. It is a poor model for a 7-day transfer page.

## iCloud

**Opened, and not useful for limits**

- `https://support.apple.com/guide/icloud/welcome/icloud` is a welcome guide. It describes sync and iCloud+. It states no file-transfer size, no link expiry, and no guest-send rule.
- `https://support.apple.com/en-us/102419` returned HTTP 404.

No iCloud or Mail Drop number is recorded. Do not write one.

## Pixeldrain

**Pages opened**

- `https://pixeldrain.com/` returned only the title “Cloud storage and data transfer services ~ pixeldrain.” No limits were on that response.
- `https://pixeldrain.com/about` did load.

**Verified on the about page**

Files are removed after 60 days without a qualifying download. A download that fetches more than 10% of the file, and that is not a repeat inside 24 hours, resets the timer. The page says this can keep a rarely downloaded file online for a long time, and that the free plan is for public sharing, not backups. Free download limits use a 24-hour sliding window per IP; exceeding the limit still allows download, with previews off and speed reduced. The about page does not state the free cap in gigabytes. Premium is a 30-day account window. Hotlink protection can require a CAPTCHA when neither side has premium. The same page says pixeldrain has been blocked in India since April 2024, and also names the Philippines, Egypt, and Italy.

**Not verified**

Anonymous upload size, password, and encryption wording were not on the pages that loaded. Pixeldrain is a hosting site with inactivity expiry, not a 7-day private transfer. A SendToAnyone comparison should not imply the same job.

## Firefox Send

No Firefox Send page was opened. It is not a product to copy or to rank against.

## Gap analysis for SendToAnyone

**Topics competitors answer that this product can answer honestly**

- How to send a file larger than a mail attachment, with the real ceiling: 6 GB per transfer, decimal, not a binary gibibyte and not 1 TB per person. Homepage: `src/pages/HomePage.jsx`. Terms repeat it.
- Sending with no account. WeTransfer’s fetched free-plan article says the sender needs an account. That is a factual contrast SendToAnyone can make.
- How long the link lives: the sender picks from 1 hour to 7 days. Longer retention does not exist. SwissTransfer and the WeTransfer free article are explicit about expiry; SendToAnyone can be equally explicit, including “longer is not available.”
- A password that gates the download and is not written into the notification email. Confirmed in the send form (`src/pages/HomePage.jsx`), the security page (`src/pages/SecurityPage.jsx`: “a gate, not zero-knowledge end-to-end encryption”), and `passwordMatches` in `functions/lib/transferSecurity.js` (SHA-256 of the typed password, not encryption of the file).
- Email carries a link. The file is not an attachment. Homepage states this.
- A folder can be selected (`webkitdirectory` on `src/components/DropZone.jsx` and `src/components/FileList.jsx`). The homepage FAQ says the directory layout is preserved. That FAQ was not re-traced through the zip download in this research.
- File request at `/receive` (`src/pages/FileRequestPage.jsx`), with a title and instructions. Retention for those links is 168 hours in `docs/production-readiness/current-limits.md`.
- Same-network device handoff with a QR code at `/qr-transfer`. The security page says the stream is encrypted WebRTC and the file is not stored. The homepage says changing path does not change the 6 GB limit. Do not claim device transfer lifts the cap.
- A checksum the sender and recipient can compute locally at `/checksum` (SHA-256 in the browser). It checks the file they have. It does not, by itself, prove the stored object matches unless someone shares the hash out of band.
- What will not work: larger than 6 GB, longer than 7 days, a paid quota, Teams, a desktop app, or a mail plug-in. Pricing and Apps pages already say this.

**Topics to avoid**

- End-to-end or zero-knowledge encryption. Wormhole claims it. SwissTransfer’s own homepage denies it for their disk encryption. SendToAnyone’s security page denies it for the password. `src/pages/HowItWorksPage.jsx` currently says files are “client-encrypted with AES-256 before streaming.” That sentence conflicts with the security page. Do not repeat it in search content.
- Virus scanning or “every file is scanned.” TransferNow and Smash market antivirus. This app blocks dangerous executable extensions (`functions/lib/r2Engine.js`). That is not a malware scan.
- GDPR certification, a signed DPA as a live offer, multi-region residency in Mumbai, Frankfurt, and Virginia, “guaranteed privacy,” or “cryptographic deletion across all nodes.” `src/pages/CompliancePage.jsx` asserts several of these. This research did not find them implemented. Do not use that page as evidence.
- A public API, SDK, or CLI. `src/pages/ApiDocsPage.jsx` shows sample calls. `src/pages/AppsPage.jsx` says there is no CLI or SDK, and `/compare` says a public API is not offered.
- Upload or download speed numbers, delivery guarantees, or “instant inbox delivery.” `src/lib/emailStatus.js` treats provider acceptance as not the same as delivery.
- “Unlimited,” “no size limit,” or a free queue past 6 GB. Smash’s wording is theirs. This product stops at 6 GB.
- 1 TB as a user allowance, recovery of expired transfers, custom branding, SSO, widgets-as-a-product, or paid password tiers.
- Preset “delete after 1, 5, or 10 downloads.” A download counter exists in code (`maxDownloads`, `0` means unlimited in `src/lib/downloadLimit.js`). The send form copy that was read does not offer those three presets. The thin landing `create-file-sharing-link` claims them. Do not advertise that list until the form shows it.
- India-only superiority, WhatsApp as an integration, or AirDrop as if this product were AirDrop.

## Opportunities that are not clones

These are jobs the product already does. They are not new marketing sites.

- **Dated comparison on `/compare`.** One table, with the access date, and a blank or “sources disagree” cell where WeTransfer’s help center and resource articles conflict. Correct the rows that say WeTransfer is 2 GB and that TransferNow’s free password is paid-only. Those rows are stale against the pages fetched here. Keep SwissTransfer’s “not end-to-end” sentence in view so the password row stays a gate, not a crypto claim. `/vs-wetransfer` and `/vs-transfernow` already render this same page. They should stay aliases.
- **A practical guide on `/how-to-send-large-files`.** When a mail attachment fails, when 6 GB is enough, what to do with a larger project (split it; a paid plan does not exist here), how to send the password on another channel, how to pick an expiry inside 7 days, and when a same-network QR handoff is the better path because nothing is stored. Point at `/checksum` for the check after download.
- **Checksum as a tool, not an article farm.** One explanation of how to compare two SHA-256 strings after a download. No “hash generator” doorway set.
- **QR / same-network as the device page.** One page, `/qr-transfer`, for phone-to-computer. It should say both devices need to be available, the file is not kept, and the 6 GB ceiling still applies. Wormhole also ships QR codes. Do not copy their roadmap or their encryption story.

## Do not copy

Do not reuse competitor headings, page layouts, plan-card grids, review scores, “unlimited and 100% free,” “the simplest, fastest, and most secure,” carbon-footprint slogans, or branded feature names. Write the limit, the expiry, and the thing the person can do next. A page that only restates a keyword is a doorway. Google’s people-first guidance asks for a page that is useful even if it never ranks.

## Pages that did not load

- `https://wetransfer.com/pricing` — title only.
- `https://wetransfer.com/resources` — six shortcuts, then a failure notice. The full list did not load.
- WeTransfer resource articles that did load still appended a “parts of the site could not be loaded” notice. The article body above that notice was used.
- `https://support.apple.com/en-us/102419` — HTTP 404.
- `https://support.apple.com/guide/icloud/welcome/icloud` — loaded, no transfer limits.
- `https://pixeldrain.com/` — title only.
- SwissTransfer terms (CGU) URL from search — not fetched.
- `https://wormhole.app/security` — not fetched.
- Filemail Basic and large-file marketing URLs — not fetched.
- `https://help.dropbox.com/plans/dropbox-transfer-plan` — not fetched.
- Smash recipient-account FAQ — not fetched.
