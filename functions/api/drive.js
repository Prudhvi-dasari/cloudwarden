export async function onRequest() {
  return new Response(JSON.stringify({
    status: 'retired',
    provider: 'cloudflare-r2',
    message: 'Google Drive storage is retired. Transfers use Cloudflare R2.',
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  });
}
