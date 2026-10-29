import { useId } from 'react';

function FlagMark({ code }) {
  const cc = (code || '').toUpperCase();
  if (!cc || cc.length !== 2) {
    return (
      <g>
        <rect width="168" height="112" fill="#e7e5e4" />
        <circle cx="84" cy="56" r="16" fill="none" stroke="#57534e" strokeWidth="2.4" />
      </g>
    );
  }

  if (cc === 'IN') {
    const spokes = Array.from({ length: 24 }, (_, i) => {
      const angle = (i * Math.PI) / 12;
      return (
        <line
          key={i}
          x1="84"
          y1="56"
          x2={84 + Math.cos(angle) * 11}
          y2={56 + Math.sin(angle) * 11}
          stroke="#000080"
          strokeWidth="0.7"
        />
      );
    });
    return (
      <g>
        <rect width="168" height="112" fill="#FF9933" />
        <rect y="37.33" width="168" height="37.34" fill="#FFFFFF" />
        <rect y="74.67" width="168" height="37.33" fill="#138808" />
        <circle cx="84" cy="56" r="13" fill="none" stroke="#000080" strokeWidth="1.3" />
        <circle cx="84" cy="56" r="2.2" fill="#000080" />
        {spokes}
      </g>
    );
  }

  if (cc === 'US') {
    const stripes = Array.from({ length: 13 }, (_, i) => (
      <rect key={i} y={i * (112 / 13)} width="168" height={112 / 13 + 0.4} fill={i % 2 ? '#FFFFFF' : '#B22234'} />
    ));
    return (
      <g>
        {stripes}
        <rect width="72" height="60" fill="#3C3B6E" />
      </g>
    );
  }

  if (cc === 'DE') {
    return (
      <g>
        <rect width="168" height="37.33" fill="#000" />
        <rect y="37.33" width="168" height="37.34" fill="#DD0000" />
        <rect y="74.67" width="168" height="37.33" fill="#FFCE00" />
      </g>
    );
  }

  if (cc === 'AE') {
    return (
      <g>
        <rect width="168" height="37.33" fill="#00732F" />
        <rect y="37.33" width="168" height="37.34" fill="#FFFFFF" />
        <rect y="74.67" width="168" height="37.33" fill="#000" />
        <rect width="46" height="112" fill="#FF0000" />
      </g>
    );
  }

  if (cc === 'GB') {
    return (
      <g>
        <rect width="168" height="112" fill="#012169" />
        <path d="M0 0 L168 112 M168 0 L0 112" stroke="#fff" strokeWidth="18" />
        <path d="M0 0 L168 112 M168 0 L0 112" stroke="#C8102E" strokeWidth="8" />
        <path d="M84 0 V112 M0 56 H168" stroke="#fff" strokeWidth="28" />
        <path d="M84 0 V112 M0 56 H168" stroke="#C8102E" strokeWidth="16" />
      </g>
    );
  }

  return (
    <image
      href={`https://flagcdn.com/w320/${cc.toLowerCase()}.png`}
      width="168"
      height="112"
      preserveAspectRatio="xMidYMid slice"
    />
  );
}

/**
 * One connected person holding the visitor's flag.
 * Sway rotates the whole figure from the feet so limbs stay attached.
 */
export default function FlagBearer({ countryCode = '', countryName = '' }) {
  const clipId = useId().replace(/:/g, '');

  return (
    <div className="flag-bearer pointer-events-none select-none" aria-hidden="true" title={countryName}>
      <svg viewBox="0 0 500 560" className="w-full h-auto" fill="none">
        <ellipse cx="200" cy="528" rx="90" ry="14" fill="rgba(18, 12, 40, 0.28)" />

        <g className="bearer-sway">
          {/* legs */}
          <path d="M172 318 C168 380 162 440 158 492" stroke="#1E293B" strokeWidth="24" strokeLinecap="round" />
          <path d="M228 318 C232 380 238 440 246 492" stroke="#1E293B" strokeWidth="24" strokeLinecap="round" />
          <path d="M140 492 H178" stroke="#0F172A" strokeWidth="14" strokeLinecap="round" />
          <path d="M228 492 H268" stroke="#0F172A" strokeWidth="14" strokeLinecap="round" />

          {/* torso */}
          <path
            d="M148 188 C142 250 150 310 178 330 H222 C252 308 258 248 250 188 Z"
            fill="#F8FAFC"
          />
          <path d="M168 248 H232" stroke="rgba(148,163,184,0.25)" strokeWidth="6" strokeLinecap="round" />

          {/* left arm (hanging) */}
          <path
            d="M152 210 C118 240 108 300 118 360"
            stroke="#F8FAFC"
            strokeWidth="26"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="118" cy="368" r="13" fill="#F3C7A6" />

          {/* right arm (raised to pole) — continuous stroke from shoulder */}
          <path
            d="M246 208 C278 176 300 148 312 118"
            stroke="#F8FAFC"
            strokeWidth="26"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="314" cy="112" r="14" fill="#F3C7A6" />

          {/* neck + head */}
          <rect x="184" y="168" width="32" height="28" rx="12" fill="#F3C7A6" />
          <circle cx="200" cy="142" r="42" fill="#F3C7A6" />
          <path
            d="M160 138 C164 96 186 84 208 86 C244 80 254 112 246 148 C230 116 198 112 160 138 Z"
            fill="#0F172A"
          />
          <circle cx="188" cy="144" r="2.6" fill="#0F172A" />
          <circle cx="214" cy="144" r="2.6" fill="#0F172A" />
          <path d="M192 162 Q200 169 210 162" stroke="#0F172A" strokeWidth="1.8" strokeLinecap="round" />

          {/* pole */}
          <path d="M320 28 V300" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />
          <circle cx="320" cy="24" r="6" fill="#94A3B8" />

          {/* hand grip on pole */}
          <circle cx="318" cy="112" r="12" fill="#F3C7A6" />
          <path d="M312 106 C315 118 325 120 328 108" stroke="#E29D72" strokeWidth="1.8" strokeLinecap="round" />

          {/* flag */}
          <g transform="translate(324 34)">
            <g className="flag-wave">
              <clipPath id={clipId}>
                <rect width="168" height="112" rx="2" />
              </clipPath>
              <g clipPath={`url(#${clipId})`}>
                <FlagMark code={countryCode} />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
