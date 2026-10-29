import { useEffect, useId, useRef, useState } from 'react';

const PATH_D = 'M 180 790 C 460 750, 740 830, 1020 800 C 1220 780, 1340 830, 1420 860';

/**
 * Scroll-driven send path. Parcel sits on the path in the hero only —
 * later chapters hide the lane so it never cuts through page copy.
 */
export default function StoryLane({
  chapter = 'hero',
  progress = 0,
  journey = null,
  phase = 'idle',
}) {
  const pathId = `lane${useId().replace(/:/g, '')}`;
  const pathRef = useRef(null);
  const [parcel, setParcel] = useState({ x: 80, y: 560, angle: 0 });
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  const chapterBase = { hero: 0.08, ways: 0.4, security: 0.7, arrive: 0.94 };
  const base = chapterBase[chapter] ?? 0.08;
  const sending = journey != null && phase !== 'idle';
  const t = sending
    ? (phase === 'complete' ? 1 : Math.min(1, Math.max(0, journey)))
    : (reduced ? 0.08 : Math.min(0.98, Math.max(0.04, base + progress * 0.1)));

  useEffect(() => {
    if (chapter !== 'hero') return;
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(len * t);
    const ahead = path.getPointAtLength(Math.min(len, len * t + 8));
    const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
    setParcel({ x: pt.x, y: pt.y, angle });
  }, [t, chapter]);

  if (chapter !== 'hero') {
    return <div className={`story-lane story-lane--${chapter}`} aria-hidden="true" />;
  }

  return (
    <div className={`story-lane story-lane--${chapter}${phase === 'paused' || phase === 'error' || reduced ? ' is-held' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <path
          id={pathId}
          ref={pathRef}
          d={PATH_D}
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="2.5"
          strokeDasharray="1.5 18"
          strokeLinecap="round"
          className="story-main-path"
        />

        <g
          className="story-parcel"
          style={{
            transform: `translate(${parcel.x}px, ${parcel.y}px) rotate(${parcel.angle}deg)`,
          }}
        >
          <g transform="translate(-26 -18)">
            <rect width="52" height="36" rx="8" fill="#ffffff" />
            <path d="M34 0 L34 14 L52 14" fill="#ffe7c2" />
            <path d="M34 0 L52 14" fill="none" stroke="#f0b56a" strokeWidth="1.5" />
            <path d="M10 20 H30" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" opacity="0.28" />
            <path d="M10 27 H24" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" opacity="0.18" />
          </g>
        </g>
      </svg>
    </div>
  );
}
