import { useEffect, useState } from 'react';

/**
 * Swaps one true phrase at a time, with the same underline as the headline.
 * The accessible name stays the full sentence.
 */
export default function RotatingLead({ phrases, label }) {
  const [index, setIndex] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(motion.matches);
    apply();
    motion.addEventListener('change', apply);
    return () => motion.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reduce || phrases.length < 2) return undefined;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % phrases.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [reduce, phrases.length]);

  if (reduce) return <p className="ds-lead">{label}</p>;

  return (
    <p className="ds-lead ds-cycle" aria-label={label}>
      <span className="ds-cycle-stack" aria-hidden="true">
        {phrases.map((phrase, i) => (
          <span key={phrase} className={i === index ? 'ds-cycle-line is-on' : 'ds-cycle-line'}>
            <span className="ds-squiggle-word">
              {phrase}
              {i === index && (
                <svg className="ds-squiggle" viewBox="0 0 200 12" preserveAspectRatio="none">
                  <path d="M2 8 C 28 2, 46 11, 74 6 S 124 2, 152 7 S 186 9, 198 4" />
                </svg>
              )}
            </span>
          </span>
        ))}
      </span>
    </p>
  );
}
