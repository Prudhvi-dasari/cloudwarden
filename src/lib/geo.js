/**
 * Dynamic Client Geolocation & Edge Network Telemetry
 * Detects country, flag, region, and live latency to nearest cloud edge node.
 * Queries /api/geo (Vercel Edge headers), ipwho.is, and ipinfo.io with zero cache lock.
 */

// Country code to flag emoji helper
export function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/** Fallback clock for a connection country when the edge does not send a timezone. */
const COUNTRY_TZ = {
  IN: 'Asia/Kolkata',
  US: 'America/New_York',
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  TW: 'Asia/Taipei',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  SG: 'Asia/Singapore',
  AE: 'Asia/Dubai',
  PK: 'Asia/Karachi',
  BD: 'Asia/Dhaka',
  LK: 'Asia/Colombo',
  NP: 'Asia/Kathmandu',
  TH: 'Asia/Bangkok',
  ID: 'Asia/Jakarta',
  PH: 'Asia/Manila',
  MY: 'Asia/Kuala_Lumpur',
  AU: 'Australia/Sydney',
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  CA: 'America/Toronto',
  BR: 'America/Sao_Paulo',
  MX: 'America/Mexico_City',
  ZA: 'Africa/Johannesburg',
};

const TZ_COUNTRY = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Shanghai': 'CN',
  'Asia/Chongqing': 'CN',
  'Asia/Harbin': 'CN',
  'Asia/Urumqi': 'CN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Singapore': 'SG',
  'Asia/Dubai': 'AE',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Colombo': 'LK',
  'Asia/Kathmandu': 'NP',
  'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID',
  'Asia/Manila': 'PH',
  'Asia/Kuala_Lumpur': 'MY',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX',
  'Africa/Johannesburg': 'ZA',
};

export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function countryFromTimeZone(timeZone) {
  return TZ_COUNTRY[timeZone] || null;
}

function countryNameFromCode(cc) {
  if (!cc) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) || cc;
  } catch {
    return cc;
  }
}

function asTimeZone(timezone) {
  if (!timezone) return '';
  if (typeof timezone === 'string') return timezone;
  return timezone.id || timezone.time_zone || '';
}

/**
 * Flag and sun follow the IP country only.
 * India IP → India, China IP → China, and the same for every other country.
 * The laptop clock is not allowed to rewrite that.
 */
export function resolveVisitorPlace({ countryCode, city, timezone, ip } = {}) {
  const ipCountry = countryCode && String(countryCode).length === 2
    ? String(countryCode).toUpperCase()
    : null;
  const ipZone = asTimeZone(timezone);
  const zoneCountry = countryFromTimeZone(ipZone);
  const timeZone = ipCountry
    ? ((ipZone && (!zoneCountry || zoneCountry === ipCountry)) ? ipZone : (COUNTRY_TZ[ipCountry] || ipZone || getDeviceTimeZone()))
    : (ipZone || getDeviceTimeZone());

  if (!ipCountry) {
    return {
      countryCode: '',
      countryName: '',
      city: city || '',
      flag: '🌐',
      timeZone,
      ip: ip || '',
    };
  }

  return {
    countryCode: ipCountry,
    countryName: countryNameFromCode(ipCountry),
    city: city || '',
    flag: getCountryFlag(ipCountry),
    timeZone,
    ip: ip || '',
  };
}

export function guessVisitorPlace() {
  return resolveVisitorPlace({});
}

// Country code to default region name
const REGION_MAP = {
  IN: 'Mumbai Edge Cluster',
  US: 'Virginia US-East Node',
  GB: 'London European Hub',
  DE: 'Frankfurt Central Edge',
  FR: 'Paris Cloud Region',
  NL: 'Amsterdam Edge Cluster',
  CA: 'Toronto North Hub',
  AU: 'Sydney Oceanic Edge',
  SG: 'Singapore Asia Gateway',
  JP: 'Tokyo East Cluster',
  AE: 'Dubai Middle East Node',
  BR: 'São Paulo South Hub',
  KR: 'Seoul Asia Edge',
  ZA: 'Cape Town Africa Node',
  MX: 'Mexico City Hub',
  IT: 'Milan European Node',
  ES: 'Madrid European Edge',
  RU: 'Moscow East Node',
  CN: 'Hong Kong Gateway',
};

export async function detectClientGeo() {
  const startTime = performance.now();

  // Connection country from our edge only. A VPN exit is reported as-is.
  // If the edge cannot see a country, stay neutral — do not guess from the clock or a third party.
  try {
    const res = await fetch(`/api/geo?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.countryCode && String(data.countryCode).length === 2) {
        const place = resolveVisitorPlace({
          countryCode: data.countryCode,
          city: data.city,
          timezone: data.timezone,
          ip: data.ip,
        });
        const latency = Math.round(performance.now() - startTime);
        return {
          ...place,
          detected: true,
          edgeRegion: REGION_MAP[place.countryCode] || `${place.city || place.countryName} Edge`,
          latencyMs: latency,
        };
      }
    }
  } catch {
    // Neutral fallback below.
  }

  // Local Vite has no Cloudflare country header. Use the device zone only
  // while developing, so the flag can be seen. Production stays on the IP.
  if (import.meta.env?.DEV) {
    const zone = getDeviceTimeZone();
    const fromZone = countryFromTimeZone(zone);
    if (fromZone) {
      return {
        ...resolveVisitorPlace({ countryCode: fromZone, timezone: zone }),
        detected: false,
        edgeRegion: '',
        latencyMs: null,
      };
    }
  }

  const place = guessVisitorPlace();
  return {
    ...place,
    detected: false,
    edgeRegion: '',
    latencyMs: null,
  };
}
