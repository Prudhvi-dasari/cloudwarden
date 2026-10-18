/**
 * Sky phase for the home backdrop from the visitor's own clock.
 * Pass a timezone (device or edge geo). Never a hardcoded country.
 */

export function getSkyTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const SKY_PHASES = {
  morning: {
    id: 'morning',
    sun: { left: '10%', top: '48%', scale: 1, opacity: 1 },
    moon: { left: '78%', top: '18%', opacity: 0.22 },
    glow: { left: '-2%', top: '28%', opacity: 0.55 },
    stars: 0,
    hills: { far: 'rgba(120, 90, 160, 0.42)', near: '#1a1430' },
  },
  afternoon: {
    id: 'afternoon',
    sun: { left: '14%', top: '18%', scale: 1.08, opacity: 1 },
    moon: { left: '78%', top: '18%', opacity: 0 },
    glow: { left: '0%', top: '2%', opacity: 0.7 },
    stars: 0,
    hills: { far: 'rgba(88, 62, 150, 0.45)', near: '#1a1430' },
  },
  evening: {
    id: 'evening',
    sun: { left: '12%', top: '58%', scale: 1.12, opacity: 1 },
    moon: { left: '72%', top: '22%', opacity: 0.35 },
    glow: { left: '-4%', top: '36%', opacity: 0.65 },
    stars: 0.25,
    hills: { far: 'rgba(100, 60, 120, 0.5)', near: '#141022' },
  },
  night: {
    id: 'night',
    sun: { left: '12%', top: '88%', scale: 0.6, opacity: 0 },
    moon: { left: '72%', top: '16%', opacity: 1 },
    glow: { left: '60%', top: '8%', opacity: 0.35 },
    stars: 1,
    hills: { far: 'rgba(40, 48, 90, 0.55)', near: '#0c0e1a' },
  },
};

const GRADIENTS = {
  morning:
    'radial-gradient(520px 300px at 12% 52%, rgba(255, 210, 140, 0.55), transparent 68%), linear-gradient(180deg, #5b8fd9 0%, #8eb6f0 22%, #f0c9a0 52%, #d4a0c0 72%, #2a1f48 100%)',
  afternoon:
    'radial-gradient(540px 280px at 16% 28%, rgba(255, 230, 160, 0.6), transparent 68%), linear-gradient(180deg, #1d4ed8 0%, #5b86f5 24%, #9eb6ff 46%, #f3c39a 68%, #8d6bb8 84%, #1a1430 100%)',
  evening:
    'radial-gradient(480px 320px at 14% 62%, rgba(255, 140, 80, 0.55), transparent 70%), linear-gradient(180deg, #2a3a7a 0%, #6b4a9a 28%, #e08860 55%, #8a4068 78%, #120e22 100%)',
  night:
    'radial-gradient(380px 260px at 72% 18%, rgba(200, 220, 255, 0.22), transparent 65%), linear-gradient(180deg, #060814 0%, #10182e 36%, #1a2040 62%, #0c0e1a 100%)',
};

export function getIndiaHourMinute(date = new Date(), timeZone = getSkyTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour: hour === 24 ? 0 : hour, minute };
}

export function getIndiaSkyPhase(date = new Date(), timeZone = getSkyTimeZone()) {
  const { hour, minute } = getIndiaHourMinute(date, timeZone);
  const t = hour + minute / 60;
  if (t >= 5 && t < 11) return 'morning';
  if (t >= 11 && t < 17) return 'afternoon';
  if (t >= 17 && t < 19.5) return 'evening';
  return 'night';
}

export function getIndiaSkyConfig(date = new Date(), timeZone = getSkyTimeZone()) {
  const phase = getIndiaSkyPhase(date, timeZone);
  return {
    phase,
    timeZone,
    gradient: GRADIENTS[phase],
    ...SKY_PHASES[phase],
  };
}
