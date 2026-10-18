export default function handler(req, res) {
  const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || null;
  const city = req.headers['x-vercel-ip-city'] || req.headers['x-vercel-ip-country-region'] || '';
  const timezone = req.headers['x-vercel-ip-timezone'] || '';
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({
    countryCode: country && country !== 'XX' && country !== 'T1' ? String(country).toUpperCase() : null,
    city: city ? decodeURIComponent(city) : '',
    timezone,
    ip
  });
}
