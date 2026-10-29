export function checkoutReturnState(params) {
  const status = String(params?.get?.('status') || params?.status || '').toLowerCase();
  const paymentId = params?.get?.('payment_id') || params?.payment_id || '';
  const subscriptionId = params?.get?.('subscription_id') || params?.subscription_id || '';
  const returned = params?.get?.('checkout') === 'return' || params?.checkout === 'return' || Boolean(paymentId || subscriptionId);
  if (!returned) return null;
  if (status === 'failed' || status === 'failure') {
    return { confirmed: false, tone: 'failed', message: 'The payment page reported a failure. Paid access has not changed.' };
  }
  if (status === 'cancelled' || status === 'canceled') {
    return { confirmed: false, tone: 'cancelled', message: 'The payment page reported a cancellation. Paid access has not changed.' };
  }
  return {
    confirmed: false,
    tone: 'pending',
    message: 'You are back from checkout. Paid access changes only after the server confirms the payment.',
  };
}
