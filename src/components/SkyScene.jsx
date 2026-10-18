import { useEffect, useState } from 'react';
import { getIndiaSkyConfig, getSkyTimeZone } from '../lib/indiaSky';

/**
 * Full-page sky lit by the visitor's timezone (device clock, or the
 * timezone their connection resolves to). Scroll only nudges parallax.
 */
export default function SkyScene({ scrollY = 0, chapter = 'hero', timeZone }) {
  const zone = timeZone || getSkyTimeZone();
  const [sky, setSky] = useState(() => getIndiaSkyConfig(new Date(), zone));

  useEffect(() => {
    const tick = () => setSky(getIndiaSkyConfig(new Date(), zone));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [zone]);

  const parallax = Math.min(120, scrollY * 0.08);
  const sun = sky.sun;
  const moon = sky.moon;
  const glow = sky.glow;
  // Dim sky once the user leaves the first viewport (hills are viewport-fixed)
  const pastHero = scrollY > 120;
  const quiet = chapter !== 'hero' || pastHero;
  const bodyMul = quiet ? 0.12 : 1;

  return (
    <div
      className={`sky-scene sky-scene--page sky-phase-${sky.phase}${quiet ? ' is-quiet' : ''}`}
      style={{ background: sky.gradient }}
      aria-hidden="true"
    >
      <div
        className="sky-sun-glow"
        style={{
          left: glow.left,
          top: glow.top,
          opacity: (glow.opacity ?? 1) * bodyMul,
          transform: `translate3d(0, ${parallax * 0.35}px, 0)`,
        }}
      />

      <div
        className="sky-sun"
        style={{
          left: sun.left,
          top: sun.top,
          opacity: (sun.opacity ?? 1) * bodyMul,
          transform: `translate3d(0, ${parallax * 0.5}px, 0) scale(${sun.scale})`,
        }}
      />

      <div
        className="sky-moon"
        style={{
          left: moon.left,
          top: moon.top,
          opacity: (moon.opacity ?? 1) * (quiet ? 0.35 : 1),
          transform: `translate3d(0, ${parallax * 0.4}px, 0)`,
        }}
      />

      {sky.stars > 0 && (
        <div className="sky-stars" style={{ opacity: sky.stars }} />
      )}

      <div className="sky-cloud c1" />
      <div className="sky-cloud c2" />
      <div className="sky-cloud c3" />

      <div
        className="sky-readability"
        style={{
          opacity: quiet
            ? 0
            : sky.phase === 'afternoon' || sky.phase === 'morning'
              ? 0.55
              : 0.35,
          transition: 'opacity 0.55s ease',
        }}
      />

      <svg
        className="sky-hills"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        style={{
          transform: `translate3d(0, ${parallax * 0.2}px, 0)`,
          opacity: quiet ? 0 : 1,
          transition: 'opacity 0.55s ease',
        }}
      >
        <path
          d="M0 150 C240 40 460 210 740 120 C1020 30 1220 170 1440 90 L1440 320 L0 320 Z"
          fill={sky.hills.far}
        />
        <path
          d="M0 210 C280 150 500 270 800 200 C1080 140 1260 250 1440 190 L1440 320 L0 320 Z"
          fill={sky.hills.near}
        />
      </svg>
    </div>
  );
}
