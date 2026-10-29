import { checkSharedLimit, trustedClientIp } from '../lib/rateLimit.js';
import { deliverTransferMail, holdTransferMail, prepareTransferMail } from '../lib/mailService.js';
import { opsEvent } from '../lib/opsLog.js';
import { previewBlockResponse, previewEmailAllowed } from '../lib/previewGuard.js';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

function logMail(result, started) {
  const accepted = result?.success === true && result?.status === 'accepted';
  const reason = String(result?.reason || '');
  const safeReason = /^[A-Za-z0-9_]{1,64}$/.test(reason) ? reason.toUpperCase() : 'UNCLASSIFIED';
  let outcome = 'rejected';
  if (accepted) outcome = 'provider_accepted';
  else if (result?.status === 'partial') outcome = 'partial';
  else if (result?.status === 'fallback') outcome = 'held';
  else if (result?.status === 'uncertain' || result?.delivery === 'unknown') outcome = 'unconfirmed';
  opsEvent({
    event: 'email',
    result: outcome,
    category: accepted ? 'UNCONFIRMED_DELIVERY' : safeReason,
    count: Number(result?.dispatchedCount || 0),
    durationMs: Date.now() - started,
  });
}

function httpStatusFor(result) {
  if (result?.success === true && result?.status === 'accepted') return 200;
  if (result?.status === 'fallback') {
    if (result.reason === 'no_smtp_configured' || result.reason === 'invalid_api_key') return 503;
    return 200;
  }
  if (result?.status === 'partial') return 200;
  if (result?.reason === 'invalid_sender') return 422;
  if (result?.reason === 'provider_timeout') return 504;
  if (
    result?.reason === 'connection_failed'
    || result?.reason === 'provider_unavailable'
    || result?.reason === 'invalid_api_key'
    || result?.reason === 'missing_provider_id'
  ) return 503;
  if (result?.reason === 'idempotency_in_progress' || result?.status === 'uncertain') return 409;
  return 502;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
      },
    });
  }
  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed', success: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const previewBlock = previewBlockResponse(request, env);
  if (previewBlock) return previewBlock;

  const started = Date.now();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const malformed = {
      success: false,
      status: 'rejected',
      delivery: 'none',
      reason: 'malformed_input',
      code: 'MALFORMED_INPUT',
      error: 'Missing recipient emails or shareId',
      dispatchedCount: 0,
    };
    logMail(malformed, started);
    return json(400, malformed);
  }
  const prepared = prepareTransferMail(env, body);
  if (prepared.error) {
    const malformed = {
      success: false,
      status: 'rejected',
      delivery: 'none',
      reason: 'malformed_input',
      code: 'MALFORMED_INPUT',
      error: prepared.error,
      dispatchedCount: 0,
      excludedCount: prepared.excludedCount || 0,
    };
    logMail(malformed, started);
    return json(400, malformed);
  }

  if (!previewEmailAllowed(request, env, prepared.recipients)) {
    const held = holdTransferMail(prepared, 'preview_email_disabled');
    logMail(held, started);
    return json(200, held);
  }

  const limit = await checkSharedLimit(env, 'email', trustedClientIp(request));
  if (!limit.allowed) {
    const reason = limit.blocked ? 'rate_limited' : 'limiter_unavailable';
    const held = holdTransferMail(prepared, reason);
    logMail(held, started);
    return json(200, held);
  }

  const result = await deliverTransferMail(env, prepared);
  logMail(result, started);
  return json(httpStatusFor(result), result);
}
