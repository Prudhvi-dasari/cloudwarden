# Canonical host

The official canonical host for SendToAnyone is **https://sendtoanyone.com**.

All search engines, sitemaps, robots.txt directives, OpenGraph tags, Twitter cards, JSON-LD schemas, and transactional emails point exclusively to **https://sendtoanyone.com**.

## Host Consolidation

- Canonical Origin: `https://sendtoanyone.com`
- Root stays `https://sendtoanyone.com/` (the origin root keeps its slash).
- Every other public path has no trailing slash.
- Query strings are not part of the canonical. `/?mode=device` canonicalizes to the homepage.
- Alias paths canonicalize to the primary path in `src/components/SeoHead.jsx` (`ALIAS_TO`). They are `noindex` and they are not in the sitemap.
- `functions/_middleware.js` returns 301 from `itransfer.iprudhvi.in` and `www.sendtoanyone.com` to `https://sendtoanyone.com`, keeping the path and query. `GET /d/:id` and `GET /download/:id` move with the same slug. A trailing slash on any other public path also 301s to the slash-free URL.
- The first HTML response for each public path carries that path’s own canonical. `index.html` only has the homepage tag as a shell; the middleware replaces it before the response is sent. `/d/`, `/download/`, and `/request/` are `noindex` in that same response.
