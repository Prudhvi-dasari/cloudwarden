import { storageEngine } from './lib/s3Storage.js';
import {
  checkRateLimit,
  isMaliciousFile,
  sanitizeFileName,
  generateSecureShareId,
  validateTierConstraints,
} from './lib/security.js';

export default async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-User-Plan, X-User-Email'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract Client IP for Rate Limiting
  const clientIp = (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['cf-connecting-ip'] ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );

  const { action = 'health' } = req.query;

  try {
    // ========================================================
    // 1. Health & Connection Status
    // ========================================================
    if (action === 'health') {
      const isConfigured = Boolean(
        process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
      );

      return res.status(200).json({
        status: isConfigured ? 'active' : 'unconfigured',
        provider: 'Cloudflare R2 Object Storage',
        bucket: process.env.CLOUDFLARE_R2_BUCKET || 'itransfer-storage',
        zeroEgress: true,
        freeTierGB: 10,
        configured: isConfigured,
        securityEngine: 'Active (Anti-Malware, Zero-Traversal, Rate-Limiter)',
      });
    }

    // ========================================================
    // 2. Tier Limits & Pricing Matrix
    // ========================================================
    if (action === 'tier-limits') {
      return res.status(200).json({
        tiers: {
          free: {
            name: 'Free / Guest',
            maxFileSizeGB: 5,
            maxRetentionDays: 7,
            allowedExpiryHours: [1, 24, 72, 168],
            permanentAllowed: false,
            priorityBandwidth: false,
          },
          trial: {
            name: '7-Day Pro Trial',
            maxFileSizeGB: 15,
            maxRetentionDays: 14,
            allowedExpiryHours: [1, 24, 72, 168, 336],
            permanentAllowed: false,
            priorityBandwidth: true,
            trialDurationDays: 7,
          },
          pro: {
            name: 'iTransfer Pro',
            maxFileSizeGB: 25,
            maxRetentionDays: 30,
            allowedExpiryHours: [1, 24, 72, 168, 720, 0],
            permanentAllowed: true,
            priorityBandwidth: true,
          },
        },
      });
    }

    // ========================================================
    // 3. Initiate Multipart Upload (Hacker Shield & Tier Check)
    // ========================================================
    if (action === 'initiate-upload' && req.method === 'POST') {
      // 1. IP Rate Limit (Max 30 uploads / min)
      const rateCheck = checkRateLimit(clientIp, 'upload', 30);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: `Upload rate limit reached. Please wait ${rateCheck.retryAfter}s before starting new transfers.`,
          retryAfter: rateCheck.retryAfter,
        });
      }

      const {
        fileName,
        fileSize = 0,
        expiryHours = 168,
        userPlan = req.headers['x-user-plan'] || 'free',
        contentType = 'application/octet-stream',
      } = req.body || {};

      // 2. Anti-Malware / Dangerous File Shield
      const malwareCheck = isMaliciousFile(fileName);
      if (malwareCheck.isDangerous) {
        return res.status(400).json({
          error: malwareCheck.reason,
          code: 'MALICIOUS_FILE_BLOCKED',
        });
      }

      // 3. Tier & Expiry Constraints
      const constraintCheck = validateTierConstraints({ fileSize, expiryHours, userPlan });
      if (!constraintCheck.valid) {
        return res.status(403).json({ error: constraintCheck.error, code: 'TIER_LIMIT_EXCEEDED' });
      }

      // 4. Neutralize Path Traversal
      const safeName = sanitizeFileName(fileName);
      const shareId = generateSecureShareId(10);
      const key = `transfers/${Date.now()}-${shareId}/${safeName}`;

      const session = await storageEngine.initiateMultipartUpload(key, contentType);
      return res.status(200).json({
        ...session,
        shareId,
        safeFileName: safeName,
        expiresInHours: expiryHours,
      });
    }

    // ========================================================
    // 4. Get Presigned Part Upload URL
    // ========================================================
    if (action === 'get-part-url' && req.method === 'POST') {
      const { s3Key, uploadId, partNumber } = req.body || {};
      if (!s3Key || !uploadId || !partNumber) {
        return res.status(400).json({ error: 'Missing s3Key, uploadId, or partNumber' });
      }

      // Strict validation on s3Key path format
      if (!s3Key.startsWith('transfers/')) {
        return res.status(400).json({ error: 'Invalid storage key prefix' });
      }

      const partInfo = await storageEngine.getPresignedPartUrl(s3Key, uploadId, Number(partNumber));
      return res.status(200).json(partInfo);
    }

    // ========================================================
    // 5. Complete Multipart Upload
    // ========================================================
    if (action === 'complete-upload' && req.method === 'POST') {
      const { s3Key, uploadId, parts } = req.body || {};
      if (!s3Key || !uploadId || !parts) {
        return res.status(400).json({ error: 'Missing s3Key, uploadId, or parts' });
      }

      const result = await storageEngine.completeMultipartUpload(s3Key, uploadId, parts);
      return res.status(200).json(result);
    }

    // ========================================================
    // 6. Presigned Single PUT URL (Files < 100MB)
    // ========================================================
    if (action === 'get-put-url' && req.method === 'POST') {
      const rateCheck = checkRateLimit(clientIp, 'upload', 30);
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: 'Rate limit exceeded.', retryAfter: rateCheck.retryAfter });
      }

      const {
        fileName,
        fileSize = 0,
        expiryHours = 168,
        userPlan = req.headers['x-user-plan'] || 'free',
        contentType = 'application/octet-stream',
      } = req.body || {};

      // Malware check
      const malwareCheck = isMaliciousFile(fileName);
      if (malwareCheck.isDangerous) {
        return res.status(400).json({ error: malwareCheck.reason, code: 'MALICIOUS_FILE_BLOCKED' });
      }

      // Tier check
      const constraintCheck = validateTierConstraints({ fileSize, expiryHours, userPlan });
      if (!constraintCheck.valid) {
        return res.status(403).json({ error: constraintCheck.error, code: 'TIER_LIMIT_EXCEEDED' });
      }

      const safeName = sanitizeFileName(fileName);
      const shareId = generateSecureShareId(10);
      const key = `transfers/${Date.now()}-${shareId}/${safeName}`;

      const putInfo = await storageEngine.getPresignedPutUrl(key, contentType);
      return res.status(200).json({
        ...putInfo,
        shareId,
        safeFileName: safeName,
      });
    }

    // ========================================================
    // 7. Get Presigned Download URL
    // ========================================================
    if (action === 'download-url') {
      const rateCheck = checkRateLimit(clientIp, 'download', 120);
      if (!rateCheck.allowed) {
        return res.status(429).json({ error: 'Download rate limit exceeded. Please wait a moment.' });
      }

      const { s3Key, customFileName } = req.query;
      if (!s3Key) {
        return res.status(400).json({ error: 'Missing s3Key' });
      }

      // Neutralize path traversal
      if (!s3Key.startsWith('transfers/') || s3Key.includes('..')) {
        return res.status(400).json({ error: 'Invalid or restricted storage key' });
      }

      const safeCustomName = customFileName ? sanitizeFileName(customFileName) : null;
      const downloadUrl = await storageEngine.getPresignedDownloadUrl(s3Key, safeCustomName);
      return res.status(200).json({ downloadUrl });
    }

    // ========================================================
    // 8. Automated Purge / Cleanup (7, 14, 30 Days Expiry)
    // ========================================================
    if (action === 'cleanup') {
      const { maxAgeHours = 168 } = req.query; // default 7 days = 168h
      const cleanupResult = await storageEngine.purgeExpiredTransfers(Number(maxAgeHours));
      return res.status(200).json({
        message: 'Cloudflare R2 expired transfers purge completed',
        ...cleanupResult,
      });
    }

    return res.status(400).json({ error: `Unsupported action "${action}"` });
  } catch (err) {
    console.error('Cloudflare R2 API Error:', err);
    return res.status(500).json({ error: err.message || 'Cloudflare R2 operation failed' });
  }
}
