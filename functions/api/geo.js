export async function onRequest(context) {
  const { request } = context;
  const cf = request.cf || {};
  const country = cf.country || request.headers.get('cf-ipcountry');
  const city = cf.city || request.headers.get('cf-ipcity') || '';
  const timezone = cf.timezone || '';
  const usable = country && country !== 'XX' && country !== 'T1';
  return new Response(JSON.stringify({
    countryCode: usable ? String(country).toUpperCase() : null,
    city,
    timezone,
    colo: cf.colo || '',
    ip: request.headers.get('cf-connecting-ip') || '',
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
