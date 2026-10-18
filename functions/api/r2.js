import { handleR2Request } from '../lib/r2Engine.js';

export async function onRequest(context) {
  return handleR2Request({ request: context.request, env: context.env });
}
