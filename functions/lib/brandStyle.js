/** Safe download-page branding. Never returns CSS or HTML. */

function channel(hex, index) {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
}

function luminance(hex) {
  const parts = [0, 1, 2].map((index) => {
    const value = channel(hex, index);
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

export function contrastRatio(left, right) {
  const hi = Math.max(luminance(left), luminance(right));
  const lo = Math.min(luminance(left), luminance(right));
  return (hi + 0.05) / (lo + 0.05);
}

export function expandHex(value) {
  const raw = String(value || '').trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return '';
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  return raw.toLowerCase();
}

/** Accent is kept only when body text can stay at WCAG AA against it. */
export function sanitizeAccent(value) {
  const hex = expandHex(value);
  if (!hex) return null;
  // The accent is a stripe on a white card. Reject colors that disappear on white.
  // Page text stays the existing ink, so a pale accent cannot wash the words out.
  if (contrastRatio(hex, '#ffffff') < 3) return null;
  return { accent: hex, ink: '#060a12' };
}

export function sanitizeHttpsUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    if (url.href.length > 500) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function sanitizeBrandMessage(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 240);
}

export function publicBrand(row) {
  const accent = sanitizeAccent(row?.brand_accent || row?.brandAccent);
  const background = sanitizeHttpsUrl(row?.brand_background_url || row?.brandBackgroundUrl);
  const message = sanitizeBrandMessage(row?.brand_message || row?.brandMessage);
  const logo = sanitizeHttpsUrl(row?.brand_logo_url || row?.brandLogo);
  if (!accent && !background && !message && !logo) return null;
  return {
    brandLogo: logo || null,
    brandAccent: accent?.accent || null,
    brandInk: accent?.ink || null,
    brandBackground: background || null,
    brandMessage: message || null,
  };
}
