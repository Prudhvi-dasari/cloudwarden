/**
 * iTransfer Enterprise Security & Anti-Hacking Guard
 * Protects against Malware distribution, Path Traversal, Brute-Force, and DoS.
 */

import crypto from 'crypto';

// Dangerous and Executable File Extensions (Malware Vectors)
export const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'zsh', 'vbs', 'vbe',
  'jse', 'wsf', 'wsh', 'msc', 'msi', 'msp', 'com', 'scr',
  'hta', 'cpl', 'pif', 'reg', 'dll', 'sys', 'drv', 'ocx',
  'ps1', 'ps1xml', 'ps2', 'ps2xml', 'psc1', 'psc2',
  'apk', 'app', 'dmg', 'pkg', 'deb', 'rpm'
]);

// Blocked Sensitive System Filenames
export const BLOCKED_FILENAMES = new Set([
  '.env', '.env.local', '.env.production', '.git', '.gitignore',
  '.htaccess', '.htpasswd', 'id_rsa', 'id_ed25519', 'authorized_keys',
  'shadow', 'passwd', 'web.config'
]);

// Sliding-window IP Rate Limiter
const rateLimitMap = new Map();
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 mins

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > 60000) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Check IP Rate Limit
 * @param {string} ip Client IP Address
 * @param {'upload'|'download'|'auth'} type Action type
 * @param {number} maxRequests Max allowed requests in 60s
 */
export function checkRateLimit(ip = 'anonymous', type = 'upload', maxRequests = 30) {
  const now = Date.now();
  const windowKey = `${ip}:${type}`;
  let record = rateLimitMap.get(windowKey);

  if (!record || now - record.windowStart > 60000) {
    record = { windowStart: now, count: 1 };
    rateLimitMap.set(windowKey, record);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  record.count += 1;
  if (record.count > maxRequests) {
    const retryAfter = Math.ceil((60000 - (now - record.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true, remaining: maxRequests - record.count };
}

/**
 * Detect Dangerous or Malicious File
 */
export function isMaliciousFile(fileName = '') {
  if (!fileName || typeof fileName !== 'string') return true;

  const baseName = fileName.split('/').pop().split('\\').pop().trim().toLowerCase();

  // 1. Check blocked exact system files
  if (BLOCKED_FILENAMES.has(baseName)) {
    return { isDangerous: true, reason: 'System and configuration files are restricted.' };
  }

  // 2. Check for double extension tricks (e.g., photo.jpg.exe)
  const parts = baseName.split('.');
  if (parts.length > 2) {
    const secondLast = parts[parts.length - 2].toLowerCase();
    const last = parts[parts.length - 1].toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(last) || DANGEROUS_EXTENSIONS.has(secondLast)) {
      return { isDangerous: true, reason: `Executable and script extensions (.${last}) are blocked for security.` };
    }
  }

  // 3. Check primary file extension
  const ext = parts.pop()?.toLowerCase();
  if (ext && DANGEROUS_EXTENSIONS.has(ext)) {
    return { isDangerous: true, reason: `Executable file type (.${ext}) is blocked to protect recipients against malware.` };
  }

  return { isDangerous: false };
}

/**
 * Sanitize Filename & Neutralize Path Traversal
 */
export function sanitizeFileName(fileName = '') {
  if (!fileName) return 'file';

  // Strip null bytes, control characters, and path separators
  let clean = fileName
    .replace(/\0/g, '') // remove null bytes
    .replace(/\.\.+/g, '') // strip directory traversal dots (../../)
    .replace(/[/\\]+/g, '_') // neutralize slashes
    .replace(/[^\w\s.-]/gi, '_') // allow only safe alphanumeric, space, dot, dash, underscore
    .trim();

  // Prevent dot-leading hidden files
  if (clean.startsWith('.')) {
    clean = 'file_' + clean.substring(1);
  }

  return clean.substring(0, 150) || 'file';
}

/**
 * Generate Secure Cryptographic Share ID
 */
export function generateSecureShareId(length = 10) {
  return crypto.randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64url')
    .substring(0, length);
}

/**
 * Validate Tier Limits & Expiry
 */
export function validateTierConstraints({ fileSize = 0, expiryHours = 168, userPlan = 'free' }) {
  const planLimits = {
    free: {
      maxBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      allowedHours: [1, 24, 72, 168], // Max 7 days
      maxDays: 7,
      name: 'Free Tier',
    },
    trial: {
      maxBytes: 15 * 1024 * 1024 * 1024, // 15 GB
      allowedHours: [1, 24, 72, 168, 336], // Max 14 days
      maxDays: 14,
      name: '7-Day Pro Trial',
    },
    pro: {
      maxBytes: 25 * 1024 * 1024 * 1024, // 25 GB
      allowedHours: [1, 24, 72, 168, 720, 0], // Max 30 days & Permanent
      maxDays: 30,
      name: 'iTransfer Pro',
    },
  };

  const limit = planLimits[userPlan] || planLimits.free;

  // 1. File Size Verification
  if (fileSize > limit.maxBytes) {
    const maxGB = Math.round(limit.maxBytes / (1024 * 1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds your ${limit.name} limit (${maxGB} GB). Upgrade to Pro for up to 25 GB transfers.`,
    };
  }

  // 2. Expiration Verification
  const isAllowedExpiry = limit.allowedHours.includes(Number(expiryHours));
  if (!isAllowedExpiry && Number(expiryHours) > 0) {
    const maxHours = Math.max(...limit.allowedHours.filter(h => h > 0));
    if (Number(expiryHours) > maxHours) {
      return {
        valid: false,
        error: `Expiration of ${expiryHours}h exceeds your ${limit.name} retention limit (${limit.maxDays} days).`,
      };
    }
  }

  if (Number(expiryHours) === 0 && userPlan !== 'pro') {
    return {
      valid: false,
      error: 'Permanent storage vault (never expire) is an exclusive iTransfer Pro feature.',
    };
  }

  return { valid: true };
}
