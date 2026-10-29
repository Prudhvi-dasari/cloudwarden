/**
 * Preview requests are identified by the pages.dev deployment host, not by a
 * variable name. Known production hosts keep the existing fallbacks.
 * A production-branch deployment served on its hash URL stays on that path.
 */

const PRODUCTION_HOSTS = new Set([
  'itransfer.iprudhvi.in',
  'sendtoanyone.com',
  'itransfer-app.pages.dev',
]);

const PRODUCTION_SUPABASE_HOST = 'giyeepztahdbsejsozog.supabase.co';
const PRODUCTION_BUCKET = 'itransfer-storage';
const PRODUCTION_BRANCHES = new Set(['main', 'master']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hostnameOf(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return '';
  }
}

export function requestHostname(request) {
  return hostnameOf(request?.url || '');
}

function isPreviewPagesHost(host) {
  return host.endsWith('.itransfer-app.pages.dev') && host !== 'itransfer-app.pages.dev';
}

export function isPreviewDeployment(request, env) {
  const host = requestHostname(request);
  if (PRODUCTION_HOSTS.has(host)) return false;
  if (!isPreviewPagesHost(host)) return false;
  const branch = text(env?.CF_PAGES_BRANCH);
  if (branch && PRODUCTION_BRANCHES.has(branch)) return false;
  return true;
}

export function previewProblems(env) {
  const problems = [];
  const supabaseHost = hostnameOf(text(env?.SUPABASE_URL));
  if (!supabaseHost) problems.push('SUPABASE_URL is required on Preview.');
  else if (supabaseHost === PRODUCTION_SUPABASE_HOST) problems.push('SUPABASE_URL points at production.');

  if (!text(env?.SUPABASE_SERVICE_ROLE_KEY)) problems.push('SUPABASE_SERVICE_ROLE_KEY is required on Preview.');
  if (!text(env?.SUPABASE_PUBLISHABLE_KEY) && !text(env?.SUPABASE_ANON_KEY)) {
    problems.push('SUPABASE_PUBLISHABLE_KEY is required on Preview.');
  }

  const bucket = text(env?.CLOUDFLARE_R2_BUCKET);
  if (!bucket) problems.push('CLOUDFLARE_R2_BUCKET is required on Preview.');
  else if (bucket === PRODUCTION_BUCKET) problems.push('CLOUDFLARE_R2_BUCKET is the production bucket.');

  if (!text(env?.CLOUDFLARE_R2_ACCOUNT_ID) || !text(env?.CLOUDFLARE_R2_ACCESS_KEY_ID) || !text(env?.CLOUDFLARE_R2_SECRET_ACCESS_KEY)) {
    problems.push('Preview R2 credentials are incomplete.');
  }

  const appHost = hostnameOf(text(env?.APP_URL));
  if (!appHost) problems.push('APP_URL is required on Preview.');
  else if (PRODUCTION_HOSTS.has(appHost)) problems.push('APP_URL points at a production host.');
  else if (!isPreviewPagesHost(appHost)) problems.push('APP_URL must be the Preview pages.dev host.');

  const cleanup = text(env?.CLEANUP_SECRET);
  if (!/^preview-[A-Za-z0-9_-]{8,80}$/.test(cleanup)) {
    problems.push('CLEANUP_SECRET on Preview must be a preview-prefixed test secret.');
  }

  if (!env?.RATE_LIMITER) problems.push('RATE_LIMITER binding is required on Preview.');
  if (text(env?.RATE_LIMIT_SCOPE) !== 'preview') {
    problems.push('RATE_LIMIT_SCOPE=preview is required on Preview.');
  }

  return problems;
}

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 503,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

export function previewBlockResponse(request, env) {
  if (!isPreviewDeployment(request, env)) return null;
  const problems = previewProblems(env);
  if (problems.length === 0) return null;
  return json({
    error: 'Preview is not allowed to use production data or storage.',
    code: 'PREVIEW_ISOLATION_REQUIRED',
    problems,
  });
}

export function previewEmailAllowed(request, env, recipients) {
  if (!isPreviewDeployment(request, env)) return true;
  if (text(env?.PREVIEW_EMAIL_MODE) !== 'allowlist') return false;
  const allowed = new Set(
    text(env?.PREVIEW_EMAIL_ALLOWLIST)
      .split(/[,;\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allowed.size === 0) return false;
  return Array.isArray(recipients) && recipients.length > 0 && recipients.every((item) => allowed.has(String(item).toLowerCase()));
}
