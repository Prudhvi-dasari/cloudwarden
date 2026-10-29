/** Known flags, in the order the bands read. Everyone else is read from the flag image. */
const FLAG_BANDS = {
  IN: ['#FF9933', '#FFFFFF', '#138808'],
  US: ['#B22234', '#FFFFFF', '#3C3B6E'],
  GB: ['#012169', '#FFFFFF', '#C8102E'],
  AE: ['#00732F', '#FFFFFF', '#000000', '#FF0000'],
  JP: ['#FFFFFF', '#BC002D', '#FFFFFF'],
  DE: ['#000000', '#DD0000', '#FFCE00'],
  FR: ['#0055A4', '#FFFFFF', '#EF4135'],
  BR: ['#009C3B', '#FFDF00', '#002776'],
  KR: ['#FFFFFF', '#CD2E3A', '#0047A0'],
  SG: ['#EF3340', '#FFFFFF', '#EF3340'],
  AU: ['#012169', '#FFFFFF', '#E4002B'],
  CA: ['#FF0000', '#FFFFFF', '#FF0000'],
  NG: ['#008751', '#FFFFFF', '#008751'],
  ZA: ['#007A4D', '#FFB612', '#DE3831', '#002395'],
  MX: ['#006847', '#FFFFFF', '#CE1126'],
};

const memory = new Map();

function hex(r, g, b) {
  const part = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function readBands(data, w, h) {
  const groups = new Map();
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 200) continue;
      const key = `${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`;
      let group = groups.get(key);
      if (!group) {
        group = { n: 0, r: 0, g: 0, b: 0, x: 0, y: 0 };
        groups.set(key, group);
      }
      group.n += 1;
      group.r += data[i];
      group.g += data[i + 1];
      group.b += data[i + 2];
      group.x += x;
      group.y += y;
    }
  }

  const clusters = [];
  [...groups.values()]
    .sort((a, b) => b.n - a.n)
    .forEach((group) => {
      const color = { r: group.r / group.n, g: group.g / group.n, b: group.b / group.n };
      const near = clusters.find((cluster) => {
        const dr = cluster.r - color.r;
        const dg = cluster.g - color.g;
        const db = cluster.b - color.b;
        return dr * dr + dg * dg + db * db < 42 * 42;
      });
      if (near) {
        const n = near.n + group.n;
        near.r = (near.r * near.n + color.r * group.n) / n;
        near.g = (near.g * near.n + color.g * group.n) / n;
        near.b = (near.b * near.n + color.b * group.n) / n;
        near.x = (near.x * near.n + group.x) / n;
        near.y = (near.y * near.n + group.y) / n;
        near.n = n;
      } else {
        clusters.push({ ...color, n: group.n, x: group.x / group.n, y: group.y / group.n });
      }
    });

  const light = (cluster) => (cluster.r * 299 + cluster.g * 587 + cluster.b * 114) / 1000;
  const total = w * h;
  const ranked = clusters.filter((cluster) => cluster.n / total >= 0.08 || (light(cluster) > 235 && cluster.n / total >= 0.035));
  const pool = (ranked.length >= 2 ? ranked : clusters).slice(0, 6);
  const kept = pool.filter((cluster) => {
    const blend = pool.some((a) => pool.some((b) => {
      if (a === b || a === cluster || b === cluster) return false;
      if (cluster.n >= a.n || cluster.n >= b.n) return false;
      const dr = cluster.r - (a.r + b.r) / 2;
      const dg = cluster.g - (a.g + b.g) / 2;
      const db = cluster.b - (a.b + b.b) / 2;
      return dr * dr + dg * dg + db * db < 70 * 70;
    }));
    if (blend) return false;
    const wash = pool.some((stronger) => {
      if (stronger === cluster || cluster.n >= stronger.n || light(cluster) > 210) return false;
      const dr = cluster.r - stronger.r;
      const dg = cluster.g - stronger.g;
      const db = cluster.b - stronger.b;
      const wr = 255 - stronger.r;
      const wg = 255 - stronger.g;
      const wb = 255 - stronger.b;
      const dot = dr * wr + dg * wg + db * wb;
      const mag = Math.hypot(dr, dg, db) * Math.hypot(wr, wg, wb);
      return mag > 0 && dot / mag > 0.92;
    });
    return !wash;
  }).slice(0, 4);
  const xs = kept.map((cluster) => cluster.x);
  const ys = kept.map((cluster) => cluster.y);
  const across = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
  kept.sort((a, b) => (across ? a.x - b.x : a.y - b.y));
  return kept.map((cluster) => hex(cluster.r, cluster.g, cluster.b));
}

function sampleFlag(code) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const w = 36;
      const h = 24;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, w, h);
      resolve(readBands(ctx.getImageData(0, 0, w, h).data, w, h));
    };
    image.onerror = () => reject(new Error('flag'));
    image.src = `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
  });
}

function storedBands(code) {
  try {
    const all = JSON.parse(sessionStorage.getItem('sta-flag-bands-v3') || '{}');
    return Array.isArray(all[code]) ? all[code] : null;
  } catch {
    return null;
  }
}

function rememberBands(code, bands) {
  try {
    const all = JSON.parse(sessionStorage.getItem('sta-flag-bands-v3') || '{}');
    all[code] = bands;
    sessionStorage.setItem('sta-flag-bands', JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

/** Flag colors for any country code. Known flags return at once; the rest are read from the flag. */
export function knownBands(code) {
  return FLAG_BANDS[String(code || '').toUpperCase()] || null;
}

export function bandsForCountry(code) {
  const cc = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return Promise.resolve(null);
  if (FLAG_BANDS[cc]) return Promise.resolve(FLAG_BANDS[cc]);
  if (memory.has(cc)) return memory.get(cc);
  const saved = storedBands(cc);
  if (saved) {
    const ready = Promise.resolve(saved);
    memory.set(cc, ready);
    return ready;
  }
  const pending = sampleFlag(cc)
    .then((bands) => {
      if (bands?.length) rememberBands(cc, bands);
      return bands?.length ? bands : null;
    })
    .catch(() => null);
  memory.set(cc, pending);
  return pending;
}
