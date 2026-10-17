/**
 * Smart Title / Subject to URL Slug Generator for iTransfer
 * Generates clean, human-readable, collision-resistant transfer slugs.
 */

// Generate a random high-entropy alphanumeric suffix (e.g. '7x2k')
export function generateRandomCode(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

/**
 * Generate a smart transfer slug based on Title / Subject
 * Example: 'hi tech machine' -> 'hi-tech-machine-a82f'
 * Example: '' -> '8xk92pq7'
 */
export function generateTransferSlug(title) {
  if (!title || typeof title !== 'string' || !title.trim()) {
    return generateRandomCode(8);
  }

  // Sanitize title to URL-safe slug
  const sanitized = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')     // Remove non-word characters (except hyphens)
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/--+/g, '-')          // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '')      // Trim leading/trailing hyphens
    .slice(0, 40);                 // Limit length to keep URLs concise

  if (!sanitized) {
    return generateRandomCode(8);
  }

  // Append short 4-char suffix to guarantee global uniqueness
  const suffix = generateRandomCode(4);
  return `${sanitized}-${suffix}`;
}

/**
 * Format live slug preview for UI as the user types
 */
export function formatLiveSlugPreview(title) {
  if (!title || !title.trim()) {
    return 'your-unique-link';
  }
  const sanitized = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return sanitized || 'your-unique-link';
}
