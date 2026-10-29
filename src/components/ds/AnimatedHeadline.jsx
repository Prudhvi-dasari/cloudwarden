/**
 * Headline that rises in word by word. The last `accent` words turn blue
 * and get a hand-drawn underline.
 */
export default function AnimatedHeadline({ text, accent = 1, as: Tag = 'h1', className = 'ds-h1', id }) {
  const words = text.split(' ').filter(Boolean);
  const split = Math.max(0, words.length - accent);
  const lead = words.slice(0, split);
  const tail = words.slice(split);

  return (
    <Tag key={text} id={id} className={className} aria-label={text}>
      <span aria-hidden="true">
        {lead.map((word, i) => (
          <span key={`${word}-${i}`}>
            <span className="ds-word" style={{ '--i': i }}>{word}</span>{' '}
          </span>
        ))}
        {tail.length > 0 && (
          <span className="ds-squiggle-word">
            {tail.map((word, j) => (
              <span key={`${word}-${j}`}>
                <span className="ds-word" style={{ '--i': split + j }}>{word}</span>
                {j < tail.length - 1 ? ' ' : ''}
              </span>
            ))}
            <svg className="ds-squiggle" viewBox="0 0 200 12" preserveAspectRatio="none" style={{ '--i': words.length - 1 }}>
              <path d="M2 8 C 28 2, 46 11, 74 6 S 124 2, 152 7 S 186 9, 198 4" />
            </svg>
          </span>
        )}
      </span>
    </Tag>
  );
}
