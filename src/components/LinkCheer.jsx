import { useEffect, useRef } from 'react';

/** Full-viewport canvas. The physics module is loaded only when this mounts. */
export default function LinkCheer({ reduced = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (reduced) return undefined;
    const canvas = ref.current;
    let cancel = () => {};
    let dead = false;
    import('../lib/linkCheer.js').then((mod) => {
      if (dead || !canvas.isConnected) return;
      cancel = mod.startLinkCheer(canvas, { reduced });
    }).catch(() => {});
    return () => {
      dead = true;
      cancel();
    };
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={ref} className="sta-cheer" aria-hidden="true" />;
}
