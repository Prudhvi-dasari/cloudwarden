/** Physics celebration for a finished transfer. Lazy-loaded. No DOM reads inside the loop. */

export const CHEER_MS = 3200;
export const BRAND_COLORS = ['#1769f5', '#4c8dff', '#9ec2ff', '#e8f0ff', '#ffffff', '#12a150', '#0b1736'];

const GRAVITY = 1680;

export function cheerBudget(width) {
  return width < 760 ? 68 : 118;
}

function piece(kind, x, y, vx, vy, color, rand) {
  const ribbon = kind === 'ribbon';
  return {
    kind,
    x,
    y,
    vx,
    vy,
    w: ribbon ? 7 + rand() * 5 : 6 + rand() * 9,
    h: ribbon ? 26 + rand() * 28 : 6 + rand() * 11,
    rot: rand() * Math.PI * 2,
    spin: (rand() - 0.5) * 9,
    flutter: rand() * Math.PI * 2,
    color,
    drag: ribbon ? 0.42 : 0.85,
  };
}

/**
 * phase: 'cannons' | 'follow' | 'shower'
 * rand is injected so tests stay deterministic.
 */
export function spawnBurst({ width, height, phase, budget, rand = Math.random, colors = BRAND_COLORS }) {
  const count = phase === 'shower'
    ? Math.round(budget * 0.34)
    : phase === 'follow'
      ? Math.round(budget * 0.28)
      : Math.round(budget * 0.72);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const color = colors[Math.floor(rand() * colors.length) % colors.length];
    const kindRoll = rand();
    const kind = kindRoll < 0.34 ? 'ribbon' : kindRoll < 0.62 ? 'tri' : 'rect';
    if (phase === 'shower') {
      out.push(piece(
        kind,
        width * (0.18 + rand() * 0.64),
        -20 - rand() * 80,
        (rand() - 0.5) * 90,
        30 + rand() * 80,
        color,
        rand,
      ));
      continue;
    }
    const left = i % 2 === 0;
    const originX = left ? width * 0.02 : width * 0.98;
    const originY = height * (0.62 + rand() * 0.12);
    const aimX = width * (0.42 + rand() * 0.16) - originX;
    const aimY = height * (0.18 + rand() * 0.16) - originY;
    const speed = (phase === 'follow' ? 520 : 780) + rand() * 280;
    const len = Math.hypot(aimX, aimY) || 1;
    out.push(piece(kind, originX, originY, (aimX / len) * speed, (aimY / len) * speed, color, rand));
  }
  return out;
}

export function stepPieces(pieces, dt) {
  const step = Math.min(0.033, Math.max(0, dt));
  for (const item of pieces) {
    item.vy += GRAVITY * step;
    const drag = Math.exp(-item.drag * step * 3.2);
    item.vx *= drag;
    item.vy *= drag;
    item.x += item.vx * step;
    item.y += item.vy * step;
    item.rot += item.spin * step;
    item.flutter += step * (item.kind === 'ribbon' ? 9 : 5);
  }
  return pieces;
}

function drawPiece(ctx, item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rot);
  const flutter = Math.cos(item.flutter);
  ctx.scale(item.kind === 'ribbon' ? Math.max(0.12, Math.abs(flutter)) : 1, 1);
  ctx.fillStyle = item.color;
  if (item.kind === 'tri') {
    ctx.beginPath();
    ctx.moveTo(0, -item.h / 2);
    ctx.lineTo(item.w / 2, item.h / 2);
    ctx.lineTo(-item.w / 2, item.h / 2);
    ctx.closePath();
    ctx.fill();
  } else if (item.kind === 'ribbon') {
    ctx.fillRect(-item.w / 2, -item.h / 2, item.w, item.h);
  } else if (item.w > item.h) {
    ctx.beginPath();
    ctx.ellipse(0, 0, item.w / 2, item.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(-item.w / 2, -item.h / 2, item.w, item.h);
  }
  ctx.restore();
}

export function startLinkCheer(canvas, { reduced = false } = {}) {
  if (!canvas || reduced) return () => {};
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return () => {};

  const parent = canvas.parentElement || document.body;
  let width = parent.clientWidth || window.innerWidth;
  let height = parent.clientHeight || window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const budget = cheerBudget(width);
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.max(1, Math.floor(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  let pieces = [];
  let last = performance.now();
  const started = last;
  let frame = 0;
  let alive = true;
  const marks = { cannons: false, follow: false, shower: false };

  const spawn = (phase) => {
    const next = spawnBurst({ width, height, phase, budget });
    if (pieces.length + next.length > budget) next.length = Math.max(0, budget - pieces.length);
    pieces = pieces.concat(next);
  };

  const tick = (now) => {
    if (!alive) return;
    const elapsed = now - started;
    const dt = Math.min(0.034, (now - last) / 1000);
    last = now;
    if (!marks.cannons) {
      marks.cannons = true;
      spawn('cannons');
    } else if (!marks.follow && elapsed > 420) {
      marks.follow = true;
      spawn('follow');
    } else if (!marks.shower && elapsed > 980) {
      marks.shower = true;
      spawn('shower');
    }
    stepPieces(pieces, dt);
    context.clearRect(0, 0, width, height);
    const fade = elapsed > CHEER_MS - 700 ? Math.max(0, (CHEER_MS - elapsed) / 700) : 1;
    context.globalAlpha = fade;
    for (const item of pieces) drawPiece(context, item);
    context.globalAlpha = 1;
    if (elapsed < CHEER_MS) {
      frame = requestAnimationFrame(tick);
    } else {
      alive = false;
      context.clearRect(0, 0, width, height);
      canvas.remove();
    }
  };
  frame = requestAnimationFrame(tick);

  return () => {
    alive = false;
    cancelAnimationFrame(frame);
  };
}
