const RESEND_URL = 'https://api.resend.com/emails';
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const PROVIDER_ID = /^[A-Za-z0-9_-]{1,256}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,256}$/;

/**
 * Resend acceptance is HTTP 2xx plus a provider message id.
 * That is not mailbox delivery. The response body is never returned or logged.
 */
export function createResendAdapter({ apiKey, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  return {
    name: 'resend',
    configured: key.length > 0,
    async send(message) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const headers = {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        };
        if (IDEMPOTENCY_KEY.test(message.idempotencyKey || '')) {
          headers['Idempotency-Key'] = message.idempotencyKey;
        }
        const response = await fetchImpl(RESEND_URL, {
          method: 'POST',
          signal: controller.signal,
          headers,
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
        });
        const data = await response.json().catch(() => null);
        const record = data && typeof data === 'object' ? data : {};
        if (response.ok) {
          const providerId = typeof record.id === 'string' ? record.id.trim() : '';
          if (PROVIDER_ID.test(providerId)) {
            return { ok: true, permanent: false, providerId };
          }
          return { ok: false, permanent: true, missingId: true, uncertain: true, status: response.status, reason: 'missing_provider_id' };
        }
        if (response.status === 409) {
          const name = typeof record.name === 'string' ? record.name : '';
          if (name === 'invalid_idempotent_request') {
            return { ok: false, permanent: true, mismatch: true, status: 409, reason: 'idempotency_mismatch' };
          }
          return { ok: false, permanent: true, uncertain: true, status: 409, reason: 'idempotency_in_progress' };
        }
        const reason = reasonForStatus(response.status, record);
        return {
          ok: false,
          permanent: !TRANSIENT_STATUS.has(response.status),
          status: response.status,
          reason,
        };
      } catch (error) {
        const timeout = isTimeout(error);
        return {
          ok: false,
          permanent: false,
          timeout,
          connection: !timeout,
          reason: timeout ? 'provider_timeout' : 'connection_failed',
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function isTimeout(error) {
  const name = error?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

function reasonForStatus(status, data) {
  const name = typeof data?.name === 'string' ? data.name : '';
  const message = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
  if (
    status === 401
    || name === 'missing_api_key'
    || name === 'invalid_api_key'
    || name === 'restricted_api_key'
  ) {
    return 'invalid_api_key';
  }
  const fromRejected = name === 'invalid_from_address' || (
    (status === 400 || status === 403 || status === 422)
    && (
      (message.includes('from') && (message.includes('invalid') || message.includes('verif') || message.includes('domain')))
      || (message.includes('domain') && message.includes('verif'))
    )
  );
  if (fromRejected) return 'invalid_sender';
  if (TRANSIENT_STATUS.has(status)) return 'provider_unavailable';
  return 'provider_rejected';
}
