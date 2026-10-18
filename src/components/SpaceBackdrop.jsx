import { useEffect, useRef } from 'react';

/**
 * Full-viewport canvas: drifting stars, rare streaks, and an Earth limb.
 * Mounted once so every route shares the same scene.
 */
export default function SpaceBackdrop() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;

    const stars = [];
    const streaks = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      stars.length = 0;
      const count = Math.min(220, Math.floor((width * height) / 9000));
      for (let i = 0; i < count; i += 1) {
        const depth = Math.random();
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: depth > 0.92 ? 1.6 : depth > 0.6 ? 1.05 : 0.6,
          a: 0.25 + Math.random() * 0.75,
          tw: Math.random() * Math.PI * 2,
          sp: 0.015 + depth * 0.08,
          drift: 0.04 + depth * 0.22,
        });
      }
    };

    const spawnStreak = () => {
      if (streaks.length > 2) return;
      const y = Math.random() * height * 0.55;
      streaks.push({
        x: -40,
        y,
        len: 80 + Math.random() * 140,
        v: 7 + Math.random() * 9,
        life: 1,
      });
    };

    const draw = (t) => {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, '#02030a');
      g.addColorStop(0.45, '#05060e');
      g.addColorStop(0.78, '#070b18');
      g.addColorStop(1, '#031018');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      const limbY = height * 0.86;
      const glow = ctx.createRadialGradient(width * 0.5, height * 1.05, 20, width * 0.5, height * 0.92, width * 0.72);
      glow.addColorStop(0, 'rgba(186, 214, 255, 0.55)');
      glow.addColorStop(0.28, 'rgba(70, 120, 210, 0.28)');
      glow.addColorStop(0.55, 'rgba(20, 40, 90, 0.12)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.beginPath();
      ctx.ellipse(width * 0.5, height * 1.18, width * 0.72, height * 0.42, 0, Math.PI, 0, true);
      ctx.fillStyle = '#010208';
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(width * 0.5, height * 1.18, width * 0.72, height * 0.42, 0, Math.PI, 0, true);
      ctx.strokeStyle = 'rgba(210, 228, 255, 0.55)';
      ctx.lineWidth = 1.25;
      ctx.stroke();

      const haze = ctx.createLinearGradient(0, limbY - 80, 0, limbY + 40);
      haze.addColorStop(0, 'rgba(120, 170, 255, 0)');
      haze.addColorStop(0.6, 'rgba(150, 190, 255, 0.16)');
      haze.addColorStop(1, 'rgba(150, 190, 255, 0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, limbY - 90, width, 140);

      for (const s of stars) {
        if (!reduce) {
          s.y -= s.drift;
          s.tw += s.sp;
          if (s.y < -4) {
            s.y = height + 4;
            s.x = Math.random() * width;
          }
        }
        const flicker = reduce ? s.a : s.a * (0.55 + Math.sin(s.tw) * 0.45);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${flicker})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduce && Math.random() < 0.008) spawnStreak();
      for (let i = streaks.length - 1; i >= 0; i -= 1) {
        const st = streaks[i];
        st.x += st.v;
        st.life -= 0.008;
        const grd = ctx.createLinearGradient(st.x - st.len, st.y, st.x, st.y);
        grd.addColorStop(0, 'rgba(255,255,255,0)');
        grd.addColorStop(1, `rgba(255,255,255,${Math.max(st.life, 0)})`);
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(st.x - st.len, st.y);
        ctx.lineTo(st.x, st.y);
        ctx.stroke();
        if (st.x > width + st.len || st.life <= 0) streaks.splice(i, 1);
      }

      if (running && !reduce) raf = requestAnimationFrame(draw);
      void t;
    };

    const boot = () => {
      resize();
      seed();
      draw(0);
    };
    boot();

    const onResize = () => {
      resize();
      seed();
      if (reduce) draw(0);
    };
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 block"
    />
  );
}
