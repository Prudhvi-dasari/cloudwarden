/**
 * Ping IndexNow after a deploy. Does not run during the build.
 * Usage: node scripts/indexnow.mjs https://sendtoanyone.com/pricing
 * With no arguments, submits every sitemap URL.
 */
import { readFileSync } from 'node:fs';

const KEY = 'a7c3e1b9d4f04a6e8c2b1d0f9e8a7c3b';
const HOST = 'sendtoanyone.com';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const urls = process.argv.slice(2);
if (urls.length === 0) {
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(match[1]);
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
});

console.log(response.status, await response.text());
if (!response.ok) process.exit(1);
