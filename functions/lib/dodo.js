const PRICES = {
  monthly: { label: 'Monthly', inr: 799 },
  yearly: { label: 'Yearly', inr: 5999 },
};

function envGet(env, key) {
  if (env && env[key]) return env[key];
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  return '';
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    },
  });
}

export async function handlePaymentRequest({ request, env }) {
  if (request.method === 'OPTIONS') return json(200, { ok: true });

  const url = new URL(request.url);
  const requested = url.searchParams.get('action') || 'checkout';
  if (requested !== 'health') {
    return json(503, { error: 'Paid plans are not available yet.', code: 'PAID_NOT_AVAILABLE' });
  }
  const action = url.searchParams.get('action') || 'checkout';
  const apiKey = envGet(env, 'DODO_API_KEY');
  const testMode = envGet(env, 'DODO_ENV') === 'test' || apiKey.startsWith('test_');
  const base = testMode ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com';
  const products = {
    monthly: envGet(env, 'DODO_PRODUCT_MONTHLY'),
    yearly: envGet(env, 'DODO_PRODUCT_YEARLY'),
  };

  if (action === 'health') {
    return json(200, {
      provider: 'dodo',
      configured: Boolean(apiKey && products.monthly && products.yearly),
      mode: testMode ? 'test' : 'live',
    });
  }

  if (!apiKey) {
    return json(503, { error: 'Dodo Payments is not configured yet. Add DODO_API_KEY.' });
  }

  if (action === 'checkout' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const cycle = body.billingCycle === 'monthly' ? 'monthly' : 'yearly';
    const productId = products[cycle];
    if (!productId) {
      return json(503, { error: `Missing Dodo product id for ${cycle}.` });
    }

    const origin = body.origin || envGet(env, 'APP_URL') || 'https://itransfer-app.pages.dev';
    const res = await fetch(`${base}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          email: body.email || undefined,
          name: body.name || undefined,
        },
        return_url: `${origin}/?payment=dodo`,
        metadata: {
          billing_cycle: cycle,
          email: body.email || '',
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json(res.status, { error: data.message || data.error || 'Dodo checkout failed.' });
    }
    const checkoutUrl = data.checkout_url || data.url || data.payment_link;
    if (!checkoutUrl) return json(502, { error: 'Dodo did not return a checkout link.' });
    return json(200, { checkoutUrl, billingCycle: cycle });
  }

  return json(400, { error: 'Unsupported payment action.' });
}
