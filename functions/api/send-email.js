import { checkSharedLimit, trustedClientIp } from '../lib/rateLimit.js';
import { deliverTransferMail, holdTransferMail, prepareTransferMail } from '../lib/mailService.js';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  });
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
    return json(405, { error: 'Method not allowed' });
  }

  const body = await request.json().catch(() => ({}));
  const prepared = prepareTransferMail(env, body);
  if (prepared.error) return json(400, { error: prepared.error });

  const limit = await checkSharedLimit(env, 'email', trustedClientIp(request));
  if (!limit.allowed) {
    const reason = limit.blocked ? 'rate_limited' : 'limiter_unavailable';
    return json(200, holdTransferMail(prepared, reason));
  }

  const result = await deliverTransferMail(env, prepared);
  return json(200, result);
}
