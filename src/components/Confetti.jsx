import { useEffect, useRef } from 'react';

export default function Confetti({ duration = 6000 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set actual canvas resolution to device pixel ratio for razor-sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colors = [
      '#c4a574', // Champagne gold
      '#d4b88a',
      '#f5f0e8', // Ivory
      '#e8dfd0',
      '#b08d5a',
      '#8fbc8f', // Soft success
      '#a39e94',
      '#f0e6d4',
    ];

    const particles = [];
    const particleCount = Math.min(100, Math.floor(width / 14)); // Responsive particle density across full screen

    for (let i = 0; i < particleCount; i++) {
      const isCircle = Math.random() > 0.65;
      const isRibbon = Math.random() > 0.5;

      particles.push({
        // Full screen horizontal spread
        x: Math.random() * width,
        // Staggered top start
        y: -20 - Math.random() * (height * 0.45),
        // Slow horizontal drifting & gentle wind oscillation
        vx: (Math.random() - 0.5) * 1.2,
        // Ultra-slow graceful downward fall velocity
        vy: Math.random() * 1.5 + 1.2,
        swaySpeed: Math.random() * 0.003 + 0.002,
        swayOffset: Math.random() * Math.PI * 2,
        swayDistance: Math.random() * 1.8 + 0.8,
        // Dimensions
        w: isRibbon ? Math.random() * 6 + 10 : Math.random() * 6 + 7,
        h: isRibbon ? Math.random() * 3 + 4 : Math.random() * 6 + 7,
        shape: isCircle ? 'circle' : 'rect',
        color: colors[Math.floor(Math.random() * colors.length)],
        // 3D-like flutter angles
        angleX: Math.random() * Math.PI * 2,
        angleY: Math.random() * Math.PI * 2,
        rotationSpeedX: (Math.random() - 0.5) * 0.04,
        rotationSpeedY: (Math.random() - 0.5) * 0.04,
        opacity: Math.random() * 0.2 + 0.8,
      });
    }

    let animationFrame;
    const startTime = performance.now();

    function render(currentTime) {
      const elapsed = currentTime - startTime;
      
      if (elapsed > duration) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Smooth fade out in the last 1.5 seconds
      const fadeProgress = elapsed > duration - 1500 
        ? Math.max(0, (duration - elapsed) / 1500) 
        : 1;

      particles.forEach((p) => {
        // Slow natural drifting with sinusoidal horizontal sway
        p.x += p.vx + Math.sin(elapsed * p.swaySpeed + p.swayOffset) * p.swayDistance;
        p.y += p.vy;

        // Flutter 3D rotation
        p.angleX += p.rotationSpeedX;
        p.angleY += p.rotationSpeedY;

        const currentAlpha = p.opacity * fadeProgress;
        if (currentAlpha <= 0.01) return;

        ctx.save();
        ctx.translate(p.x, p.y);
        
        // 3D paper flutter scale simulation
        const scaleX = Math.cos(p.angleX);
        const scaleY = Math.sin(p.angleY);
        ctx.scale(scaleX, scaleY);

        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 2);
          ctx.fill();
        }

        ctx.restore();
      });

      animationFrame = requestAnimationFrame(render);
    }

    animationFrame = requestAnimationFrame(render);

    const handleResize = () => {
      if (canvas) {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        canvas.width = newWidth * dpr;
        canvas.height = newHeight * dpr;
        ctx.scale(dpr, dpr);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [duration]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
