/**
 * Guard for the Vite development API only.
 * Production Pages never imports this module.
 * Isolated mode reads one env file and does not consult process.env.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRODUCTION_SUPABASE_HOST = 'giyeepztahdbsejsozog.supabase.co';
const PRODUCTION_BUCKET = 'itransfer-storage';
const PRODUCTION_APP_HOSTS = new Set(['itransfer.iprudhvi.in', 'itransfer-app.pages.dev', 'sendtoanyone.com', 'sendtoany.one']);

const LIMITS = {
  upload: { limit: 30, windowMs: 60_000 },
  parts: { limit: 120, windowMs: 60_000 },
  download: { limit: 120, windowMs: 60_000 },
  password: { limit: 8, windowMs: 60_000 },
  claim: { limit: 20, windowMs: 60_000 },
  delete: { limit: 20, windowMs: 60_000 },
  request: { limit: 10, windowMs: 60_000 },
  email: { limit: 5, windowMs: 60_000 },
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function looksPlaceholder(value) {
  return /replace-with|changeme|placeholder/i.test(value);
}

function parsedUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function loopbackProblem(value, label) {
  const url = parsedUrl(value);
  if (!url) return `${label} must be an absolute loopback URL.`;
  if (url.username || url.password) return `${label} must not include credentials.`;
  if (url.hash || url.search) return `${label} must not include a query or hash.`;
  const path = url.pathname.replace(/\/$/, '');
  if (path) return `${label} must be an origin without a path.`;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return `${label} must use http or https.`;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    return `${label} must use localhost, 127.0.0.1, or ::1.`;
  }
  if (!url.port) return `${label} must include an explicit port.`;
  return '';
}

function isCloudflareR2Host(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'r2.cloudflarestorage.com' || host.endsWith('.r2.cloudflarestorage.com');
}

export function validateIsolatedConfig(env = {}) {
  const problems = [];
  const supabaseUrl = text(env.SUPABASE_URL);
  const viteSupabaseUrl = text(env.VITE_SUPABASE_URL);
  const publishable = text(env.SUPABASE_PUBLISHABLE_KEY) || text(env.SUPABASE_ANON_KEY);
  const vitePublishable = text(env.VITE_SUPABASE_PUBLISHABLE_KEY) || text(env.VITE_SUPABASE_ANON_KEY);
  const serviceRole = text(env.SUPABASE_SERVICE_ROLE_KEY);
  const endpoint = text(env.CLOUDFLARE_R2_ENDPOINT);
  const region = text(env.CLOUDFLARE_R2_REGION);
  const bucket = text(env.CLOUDFLARE_R2_BUCKET);
  const appUrl = text(env.APP_URL);
  const accessKey = text(env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  const secretKey = text(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
  const accountId = text(env.CLOUDFLARE_R2_ACCOUNT_ID);

  const supabaseProblem = loopbackProblem(supabaseUrl, 'SUPABASE_URL');
  if (supabaseProblem) problems.push(supabaseProblem);
  else if (parsedUrl(supabaseUrl)?.hostname === PRODUCTION_SUPABASE_HOST) {
    problems.push('SUPABASE_URL points at the production Supabase project.');
  }

  if (viteSupabaseUrl && viteSupabaseUrl !== supabaseUrl) {
    problems.push('VITE_SUPABASE_URL must match SUPABASE_URL.');
  }
  const viteSupabaseProblem = viteSupabaseUrl ? loopbackProblem(viteSupabaseUrl, 'VITE_SUPABASE_URL') : 'VITE_SUPABASE_URL is required.';
  if (viteSupabaseProblem) problems.push(viteSupabaseProblem);

  if (!publishable || looksPlaceholder(publishable)) {
    problems.push('SUPABASE_PUBLISHABLE_KEY must be the local publishable key.');
  }
  if (!vitePublishable || looksPlaceholder(vitePublishable)) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY must be the local publishable key.');
  }
  if (vitePublishable && publishable && vitePublishable !== publishable) {
    problems.push('The browser publishable key must match the server publishable key.');
  }
  if (!serviceRole || looksPlaceholder(serviceRole)) {
    problems.push('SUPABASE_SERVICE_ROLE_KEY must be the local service-role key.');
  }
  if (serviceRole && (serviceRole === publishable || serviceRole === vitePublishable)) {
    problems.push('The service-role key must not be reused as the publishable key.');
  }

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('VITE_')) continue;
    if (/SERVICE_ROLE|SECRET|RESEND|CLEANUP/i.test(key)) {
      problems.push(`${key} would expose a server secret to the browser.`);
    }
    if (serviceRole && text(value) === serviceRole) {
      problems.push(`${key} contains the service-role key.`);
    }
  }

  const endpointProblem = loopbackProblem(endpoint, 'CLOUDFLARE_R2_ENDPOINT');
  if (endpointProblem) problems.push(endpointProblem);
  else if (isCloudflareR2Host(parsedUrl(endpoint)?.hostname)) {
    problems.push('CLOUDFLARE_R2_ENDPOINT points at Cloudflare R2.');
  }

  if (!region || region === 'auto' || !/^[a-z0-9-]+$/.test(region)) {
    problems.push('CLOUDFLARE_R2_REGION must be the local S3 region, not auto.');
  }
  if (!bucket) problems.push('CLOUDFLARE_R2_BUCKET is required.');
  else if (bucket === PRODUCTION_BUCKET) problems.push('Bucket itransfer-storage is the production bucket.');
  else if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    problems.push('CLOUDFLARE_R2_BUCKET must be a lowercase non-production bucket name.');
  }

  if (!accountId || looksPlaceholder(accountId)) problems.push('CLOUDFLARE_R2_ACCOUNT_ID is required for local signing.');
  if (!accessKey || looksPlaceholder(accessKey)) problems.push('CLOUDFLARE_R2_ACCESS_KEY_ID is required for local signing.');
  if (!secretKey || looksPlaceholder(secretKey)) problems.push('CLOUDFLARE_R2_SECRET_ACCESS_KEY is required for local signing.');

  const appProblem = loopbackProblem(appUrl, 'APP_URL');
  if (appProblem) problems.push(appProblem);
  else if (PRODUCTION_APP_HOSTS.has(parsedUrl(appUrl)?.hostname)) {
    problems.push('APP_URL points at production.');
  }

  if (text(env.RESEND_API_KEY)) problems.push('Isolated mode must not include RESEND_API_KEY.');
  const cleanup = text(env.CLEANUP_SECRET);
  if (cleanup && !/^local-[A-Za-z0-9_-]{8,80}$/.test(cleanup)) {
    problems.push('CLEANUP_SECRET must be a local-prefixed test secret.');
  }

  return { ok: problems.length === 0, problems };
}

export function createLocalRateLimiter() {
  const windows = new Map();
  return {
    async fetch(_url, init = {}) {
      let body;
      try {
        body = JSON.parse(init.body || '');
      } catch {
        return new Response(JSON.stringify({ allowed: false }), { status: 400 });
      }
      const spec = LIMITS[body?.bucket];
      const key = typeof body?.key === 'string' ? body.key : '';
      if (!spec || key.length < 1 || key.length > 256) {
        return new Response(JSON.stringify({ allowed: false }), { status: 400 });
      }
      const now = Date.now();
      const id = `${body.bucket}:${key}`;
      let record = windows.get(id);
      if (!record || now - record.windowStart >= spec.windowMs) {
        record = { windowStart: now, count: 0 };
        windows.set(id, record);
      }
      record.count += 1;
      const allowed = record.count <= spec.limit;
      return new Response(JSON.stringify({ allowed }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  };
}

export function assessViteApi({ isolated = false, env = {} } = {}) {
  if (!isolated) {
    return {
      ok: false,
      limiterEnabled: false,
      env: {},
      status: 503,
      body: {
        error: 'Local Vite will not send transfer, cleanup, or payment API calls, so development cannot reach production. The page UI still loads. Copy env/isolated.example to env/isolated/.env and start Vite with ITRANSFER_ISOLATED=1.',
        code: 'LOCAL_API_DISABLED',
      },
    };
  }

  const { ok, problems } = validateIsolatedConfig(env);
  if (!ok) {
    return {
      ok: false,
      limiterEnabled: false,
      env: {},
      status: 503,
      body: {
        error: problems.join(' '),
        code: 'ISOLATED_CONFIG_INVALID',
        problems,
      },
    };
  }

  return {
    ok: true,
    limiterEnabled: true,
    status: 200,
    body: null,
    env: {
      ...env,
      ITRANSFER_ISOLATED: '1',
      ITRANSFER_VITE_DEV: '1',
      RATE_LIMITER: createLocalRateLimiter(),
    },
  };
}

export function isolatedRuntimeBlock(env) {
  if (env?.ITRANSFER_ISOLATED !== '1') return null;
  const { ok, problems } = validateIsolatedConfig(env);
  if (ok) return null;
  return {
    status: 503,
    body: {
      error: problems.join(' ') || 'Isolated configuration is invalid.',
      code: 'ISOLATED_CONFIG_INVALID',
      problems,
    },
  };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

export async function dispatchLocalViteRequest({ request, isolated = false, env = {}, kind = 'r2' } = {}) {
  const decision = assessViteApi({ isolated, env });
  if (!decision.ok) return jsonResponse(decision.status, decision.body);
  if (kind === 'payment') {
    const { handlePaymentRequest } = await import('./dodo.js');
    return handlePaymentRequest({ request, env: decision.env });
  }
  const { handleR2Request } = await import('./r2Engine.js');
  return handleR2Request({ request, env: decision.env });
}

export function loadIsolatedEnv(root) {
  const file = resolve(root, 'env/isolated/.env');
  if (!existsSync(file)) return {};
  return parseEnvFile(readFileSync(file, 'utf8'));
}

export function parseEnvFile(source) {
  const env = {};
  for (const line of String(source || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    env[key] = value;
  }
  return env;
}
