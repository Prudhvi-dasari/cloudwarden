# Technical SEO notes

Date of this pass: 2026-10-23. Canonical origin is `https://sendtoanyone.com`. See `docs/seo/canonical-host.md`. No routes were deleted.

## What search engines actually receive

This app is a client-rendered SPA. `index.html` is the document for every route until JavaScript runs. That shell is the homepage: indexable, with the homepage title, description, and Organization / WebSite JSON-LD. `SeoHead` then replaces the title, description, canonical, robots, and JSON-LD for the route. Non-JavaScript crawlers will see the homepage metadata on deep links.

Private routes (`/d/*`, `/download/*`, `/request/*`) and alias routes also send `X-Robots-Tag: noindex, nofollow, noarchive` from `public/_headers`, which does not depend on JavaScript. `/api/*` is a Pages Function and is not covered by `_headers`.

`robots.txt` is not a security control. A disallow only asks cooperating crawlers to skip a URL. Private transfers still need auth, expiry, and unguessable ids. `/transfers` and the alias paths stay allowed so a crawler can fetch the page and read `noindex`.

## Sitemap

`public/sitemap.xml` has 23 URLs. `lastmod` is 2026-10-23, the date of this metadata pass, on every URL. There is no `changefreq` or `priority`.

Indexable, each once:

- `/`
- `/how-it-works`
- `/features`
- `/security`
- `/pricing`
- `/receive`
- `/teams`
- `/apps`
- `/api-docs`
- `/compare`
- `/qr-transfer`
- `/checksum`
- `/compliance`
- `/resources`
- `/privacy`
- `/terms`
- `/help`
- `/status`
- `/changelog`
- `/widget`
- `/send-large-files`
- `/send-files-without-signup`
- `/how-to-send-large-files`

`/apps`, `/api-docs`, `/teams`, `/widget`, and `/compliance` are real pages (`AppsPage`, `ApiDocsPage`, `TeamsPage`, `WidgetPage`, `CompliancePage`). They stay indexable. Their descriptions say what is missing: no desktop app, no public API, no team plan, no hosted widget script, and no compliance certification.

## Alias map

These routes still render. `SeoHead` sets `noindex` and the canonical below. A `customCanonical` from the page component cannot override this. They are not in the sitemap.

| Alias | Canonical |
| --- | --- |
| `/transfers` | `/` |
| `/terms-and-conditions`, `/tos` | `/terms` |
| `/contact` | `/help` (`HelpContactPage` is the same component) |
| `/vs-wetransfer`, `/vs-transfernow` | `/compare` (`ComparePage`) |
| `/file-request` | `/receive` |
| `/send-large-video`, `/send-folder-online`, `/send-files-whatsapp`, `/send-files-without-compression`, `/file-transfer-free`, `/create-file-sharing-link` | `/send-large-files` |
| `/send-files-by-email`, `/expire-file-link` | `/how-to-send-large-files` |
| `/iphone-to-windows`, `/android-to-mac`, `/phone-to-laptop`, `/airdrop-alternative`, `/p2p-file-transfer` | `/qr-transfer` |
| `/wetransfer-alternative`, `/transfernow-alternative`, `/best-wetransfer-alternative-india` | `/compare` |

`/receive` is the file-request product page. `/file-request` is the thin landing of the same intent, so it is not a second indexable URL.

`/how-it-works` stays the product walkthrough. `/how-to-send-large-files` stays the practical guide. Both are indexable because the content map treats them as different intents.

`/send-files-without-signup` stays indexable as the no-account page. `/file-transfer-free` does not; free is not a second product.

Removed from the previous sitemap because they are aliases, not because the routes were deleted: `/file-request`, `/contact`, `/vs-wetransfer`, `/vs-transfernow`, `/send-large-video`, `/send-folder-online`, `/send-files-whatsapp`, `/send-files-without-compression`, `/file-transfer-free`, `/create-file-sharing-link`, `/send-files-by-email`, `/expire-file-link`, `/iphone-to-windows`, `/android-to-mac`, `/phone-to-laptop`, `/airdrop-alternative`, `/p2p-file-transfer`, `/wetransfer-alternative`, `/transfernow-alternative`, `/best-wetransfer-alternative-india`.

## Structured data

Homepage: `Organization` and `WebSite`, name SendToAnyone, url `https://sendtoanyone.com`, logo `favicon.svg` (the file is in `public/`). No search action, because the site has no search box. No `sameAs`, contact point, or language list, because those were not verified.

Other indexable pages: `BreadcrumbList` (Home, then that page) and `WebPage`. Alias, private, and unknown routes remove JSON-LD.

Omitted on purpose: `AggregateRating`, `SoftwareApplication` / `WebApplication`, `Offer`, and `FAQPage`. The old shell claimed a free-tier price, desktop operating systems, a site search box, and a breadcrumb that was not the current page.

Open Graph and Twitter use the page title, description, and canonical URL, type `website`, card `summary`. There is no `og:image`. `public/images/hero_3d_cloudscape.jpg` is not in the repo. The only images in `public/` are `favicon.svg` and `icons.svg`.

## Claims left out of metadata

Not stated: 1 TB per user, end-to-end or zero-knowledge encryption, a named cipher for transit or storage, virus scanning, a numbered or guaranteed speed, paid plans, a public API or SDK as a live product, a hosted widget, or a compliance certification. Pricing says there is no upgrade that raises the 6 GB or 7 day limit. Security says the password gates the download and does not encrypt the file.

## Internal links

The navbar More menu links `/send-large-files`, `/send-files-without-signup`, `/how-to-send-large-files`, `/how-it-works`, and `/resources`. The footer links those guides plus `/status`, `/changelog`, `/privacy`, and `/terms`. `ResourcesPage` lists the six guides and a second list for `/apps`, `/api-docs`, `/teams`, `/widget`, `/compliance`, and the legal pages.

`/contact` still renders the help page and is `noindex` with canonical `/help`. Alias landings such as `/send-files-by-email` still render, and in-app links point at the canonical page instead.
