import { handlePaymentRequest } from '../lib/dodo.js';

export async function onRequest(context) {
  return handlePaymentRequest({ request: context.request, env: context.env });
}
