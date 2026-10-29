/**
 * Provider acceptance is not delivery. Only an explicit delivered status
 * may be shown as confirmed. A mail-app fallback is never shown as sent.
 * Fallback actions are offered only when no recipient was accepted and the
 * provider outcome is a definite miss.
 */
export function describeEmailResult(emailResult) {
  const dispatched = Number(emailResult?.dispatchedCount) || 0;

  if (emailResult?.status === 'delivered' && emailResult.delivery === 'confirmed') {
    return {
      state: 'delivered',
      badge: 'Delivered',
      summary: 'The mail provider confirmed delivery.',
      detail: 'Delivery was confirmed.',
      showFallback: false,
    };
  }
  if (emailResult?.status === 'accepted' && emailResult.delivery === 'unconfirmed' && emailResult.success === true) {
    return {
      state: 'accepted',
      badge: 'Accepted',
      summary: 'The mail provider accepted the message. Delivery is not confirmed yet.',
      detail: 'Accepted for sending. Delivery is not confirmed yet.',
      showFallback: false,
    };
  }
  if (dispatched > 0) {
    const othersUnknown = Number(emailResult?.uncertainCount) > 0 || emailResult?.reason === 'idempotency_in_progress';
    return {
      state: 'partial',
      badge: 'Partly accepted',
      summary: 'The mail provider accepted some messages. Delivery is not confirmed yet.',
      detail: othersUnknown
        ? 'Some messages were accepted. Delivery is not confirmed, and the outcome for the others is not known yet.'
        : 'Some messages were accepted. Delivery is not confirmed. The others were not accepted.',
      showFallback: false,
    };
  }
  if (emailResult?.status === 'uncertain' || emailResult?.reason === 'idempotency_in_progress') {
    return {
      state: 'uncertain',
      badge: 'In progress',
      summary: 'The mail provider has not confirmed whether this message was accepted.',
      detail: 'The outcome is not known yet. This is not a delivery confirmation, and it does not mean the message failed.',
      showFallback: false,
    };
  }
  if (emailResult?.status === 'unavailable' || emailResult?.delivery === 'unknown') {
    const connection = emailResult?.reason === 'connection_failed';
    return {
      state: 'unconfirmed',
      badge: 'Not confirmed',
      summary: connection
        ? 'The connection failed before the mail provider confirmed acceptance.'
        : 'The mail provider did not answer in time.',
      detail: 'The outcome is not known yet. This is not a provider rejection or a delivery confirmation.',
      showFallback: false,
    };
  }
  if (emailResult?.status === 'idempotency_mismatch') {
    return {
      state: 'mismatch',
      badge: 'Not accepted',
      summary: 'This request was not accepted because it did not match an earlier send.',
      detail: 'No new message was accepted. This does not confirm whether an earlier request was delivered.',
      showFallback: true,
    };
  }
  return {
    state: 'not_sent',
    badge: 'Not sent yet',
    summary: 'The files are uploaded. SendToAnyone did not send the email. Use the buttons below to open your mail app with the link filled in.',
    detail: 'Nothing has been emailed yet.',
    showFallback: true,
  };
}

export function emailTransportFailure() {
  return {
    success: false,
    status: 'unavailable',
    delivery: 'unknown',
    reason: 'connection_failed',
    code: 'CONNECTION_FAILED',
    dispatchedCount: 0,
  };
}

const EMAIL_RESPONSE_FIELDS = [
  'success', 'status', 'delivery', 'provider', 'reason', 'code', 'message',
  'downloadUrl', 'mailtoUrl', 'gmailWebUrl', 'dispatchedCount', 'uncertainCount',
  'excludedCount', 'recipients',
];

/**
 * A caller may treat only provider acceptance as success.
 * HTTP failure, a missing body, or success without acceptance stays a failure.
 */
export function interpretSendEmailResponse(httpOk, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return emailTransportFailure();
  }
  const picked = {};
  for (const key of EMAIL_RESPONSE_FIELDS) {
    if (payload[key] !== undefined) picked[key] = payload[key];
  }
  const accepted = httpOk === true
    && payload.success === true
    && payload.status === 'accepted'
    && payload.delivery === 'unconfirmed'
    && payload.provider === 'resend'
    && Number(payload.dispatchedCount) > 0;
  if (accepted) return picked;
  const claimedAccepted = payload.status === 'accepted' && httpOk !== true;
  const reason = typeof payload.reason === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(payload.reason)
    ? payload.reason
    : (claimedAccepted ? 'provider_unavailable' : 'provider_rejected');
  return {
    ...picked,
    success: false,
    status: claimedAccepted ? 'uncertain' : (typeof payload.status === 'string' ? payload.status : 'rejected'),
    delivery: claimedAccepted ? 'unknown' : (typeof payload.delivery === 'string' ? payload.delivery : 'none'),
    reason,
    dispatchedCount: Number(payload.dispatchedCount) || 0,
  };
}

export function describeExcludedRecipients(count) {
  const excluded = Number(count) || 0;
  if (excluded <= 0) return '';
  if (excluded === 1) return '1 address was invalid or over the limit and was not included.';
  return `${excluded} addresses were invalid or over the limit and were not included.`;
}
