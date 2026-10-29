import { useEffect, useState } from 'react';
import { getIndiaSkyPhase } from '../../lib/indiaSky';
import { bandsForCountry, knownBands } from '../../lib/flagBands';
import FlagBearer from '../FlagBearer';

const PROUD = {
  IN: 'From India. The file can go anywhere.',
  US: 'From the United States, sent with care.',
  GB: 'From the United Kingdom, on its way.',
  AE: 'From the Emirates, to anyone.',
  JP: 'From Japan, carefully on its way.',
  DE: 'From Germany, straight to them.',
  FR: 'From France, on its way.',
  BR: 'From Brazil, with care.',
  KR: 'From Korea, on its way.',
  SG: 'From Singapore, in a moment.',
  AU: 'From Australia, across the water.',
  CA: 'From Canada, to anyone.',
  NG: 'From Nigeria, to anyone.',
  ZA: 'From South Africa, on its way.',
  MX: 'From Mexico, to anyone.',
};

function proudQuote(code, name) {
  if (PROUD[code]) return PROUD[code];
  if (name) return `From ${name}. Proud to send it on.`;
  return '';
}

function isLightBand(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

function flagFill(colors) {
  const step = 100 / colors.length;
  const blend = Math.min(3.5, step * 0.12);
  const stops = colors.flatMap((color, i) => {
    const start = i === 0 ? 0 : i * step + blend;
    const end = i === colors.length - 1 ? 100 : (i + 1) * step - blend;
    return [`${color} ${start}%`, `${color} ${end}%`];
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** Country name painted in that flag's bands, with a gloss that slides across. */
function FlagName({ code, name }) {
  const label = name || code;
  const [bands, setBands] = useState(() => knownBands(code));

  useEffect(() => {
    let live = true;
    bandsForCountry(code).then((next) => {
      if (live) setBands(next);
    });
    return () => { live = false; };
  }, [code]);

  const colors = bands?.length ? bands : ['var(--ds-accent)'];
  const light = colors.some((color) => color.startsWith('#') && isLightBand(color));

  return (
    <span
      className={light ? 'ds-greet-kicker ds-flag-word is-light' : 'ds-greet-kicker ds-flag-word'}
      style={{ '--flag': flagFill(colors) }}
    >
      {label}
    </span>
  );
}

const CLOUDS = [
  { top: '14%', width: 220, duration: 95, delay: -20, opacity: 0.9 },
  { top: '30%', width: 320, duration: 140, delay: -85, opacity: 0.7 },
  { top: '8%', width: 160, duration: 120, delay: -50, opacity: 0.6 },
  { top: '46%', width: 260, duration: 170, delay: -130, opacity: 0.55 },
];

const STARS = [
  [8, 12], [16, 30], [24, 8], [33, 22], [41, 6], [52, 18], [61, 9], [68, 28],
  [74, 5], [86, 24], [92, 11], [12, 44], [46, 36], [58, 40], [80, 38], [95, 46],
];

/** Soft time-of-day sky that fades to the white page. Home hero only. */
export default function HeroSky({ timeZone }) {
  const [phase, setPhase] = useState(() => getIndiaSkyPhase(new Date(), timeZone));

  useEffect(() => {
    setPhase(getIndiaSkyPhase(new Date(), timeZone));
    const id = setInterval(() => setPhase(getIndiaSkyPhase(new Date(), timeZone)), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [timeZone]);

  return (
    <div className="ds-sky" data-phase={phase} aria-hidden="true">
      <div className="ds-sky-wash" />
      {phase === 'night' && STARS.map(([left, top], i) => (
        <span
          key={i}
          className="ds-sky-star"
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${(i % 5) * 0.6}s` }}
        />
      ))}
      <span className="ds-sky-orb" />
      {CLOUDS.map((cloud, i) => (
        <span
          key={i}
          className="ds-sky-cloud"
          style={{
            top: cloud.top,
            width: cloud.width,
            opacity: cloud.opacity,
            animationDuration: `${cloud.duration}s`,
            animationDelay: `${cloud.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Stands beside the journey strip. The flag follows the visitor's country. */
export function FlagGreeting({ countryCode = '', countryName = '' }) {
  if (!countryCode) return null;
  const line = proudQuote(countryCode, countryName);
  return (
    <aside className="ds-greet" aria-label={`${countryName || countryCode}. ${line}`}>
      <FlagBearer countryCode={countryCode} countryName={countryName} />
      <p className="ds-greet-quote">
        <FlagName code={countryCode} name={countryName} />
        {line}
      </p>
    </aside>
  );
}
