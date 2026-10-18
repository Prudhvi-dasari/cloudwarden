import { handleR2Request } from '../functions/lib/r2Engine.js';

function headerMap(headers) {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers || {})) {
    if (value == null) continue;
    out.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  return out;
}

export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'localhost';
  const url = `${proto}://${host}${req.url}`;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(url, {
    method: req.method,
    headers: headerMap(req.headers),
    body: hasBody ? JSON.stringify(req.body || {}) : undefined,
  });

  const response = await handleR2Request({ request, env: process.env });
  const text = await response.text();
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key === 'content-encoding') return;
    res.setHeader(key, value);
  });
  res.send(text);
}
