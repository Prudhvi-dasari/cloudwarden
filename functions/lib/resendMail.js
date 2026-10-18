const RESEND_URL = 'https://api.resend.com/emails';
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Resend is the first provider adapter. A 2xx response means the provider
 * accepted the message. It does not mean the recipient's mailbox delivered it.
 */
export function createResendAdapter({ apiKey, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  return {
    name: 'resend',
    configured: typeof apiKey === 'string' && apiKey.length > 0,
    async send(message) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(RESEND_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': message.idempotencyKey,
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
          }),
        });
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return { ok: true, permanent: false, providerId: data?.id || null };
        }
        if (response.status === 409) {
          const data = await response.json().catch(() => ({}));
          const name = typeof data?.name === 'string' ? data.name : '';
          if (name === 'invalid_idempotent_request') {
            return { ok: false, permanent: true, mismatch: true, status: 409 };
          }
          return { ok: false, permanent: true, uncertain: true, status: 409 };
        }
        return { ok: false, permanent: !TRANSIENT_STATUS.has(response.status), status: response.status };
      } catch (error) {
        const timeout = error?.name === 'AbortError';
        return { ok: false, permanent: false, timeout, connection: !timeout };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
