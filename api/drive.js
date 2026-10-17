import {
  createDriveUploadSession,
  uploadDriveChunk,
  finalizeDriveFile,
  deleteDriveFile,
  deleteDriveFolder,
  renameDriveItem,
  getDriveStorageStats,
  getDriveFileStream,
  getDriveFileMetadata,
  queryDriveUploadOffset,
  purgeEmptyTransferFolders,
} from './lib/googleDrive.js';
import crypto from 'crypto';
import { Readable } from 'stream';

const HMAC_SECRET = process.env.HMAC_SECRET || 'itransfer_secret_vault_hmac_key_2026';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://giyeepztahdbsejsozog.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XenT3T8l2M0-SWsHDJZpUg_3elJqmVU';

export const config = {
  api: {
    bodyParser: false, // Handle raw streaming chunks for Google Drive
  },
};

// Helper to buffer the raw request stream
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Generate signed temporary HMAC download token
function generateDownloadToken(shareId, expiryMs = 3600000) {
  const expires = Date.now() + expiryMs;
  const payload = `${shareId}:${expires}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

// Helper to detect MIME types by filename extension
function getMimeType(fileName, fallback = 'application/octet-stream') {
  if (!fileName) return fallback;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    pdf: 'application/pdf',
    txt: 'text/plain; charset=utf-8',
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
  };
  return mimeTypes[ext] || fallback;
}

export default async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Range, Range, X-Session-Url, X-File-Type, X-Auth-Token');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Disposition');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlObj = new URL(req.url, 'https://itransfer.iprudhvi.in');
  const action = urlObj.searchParams.get('action') || (req.method === 'GET' ? 'stats' : null);
  const fileId = urlObj.searchParams.get('fileId');
  const shareId = urlObj.searchParams.get('shareId');
  const fileName = urlObj.searchParams.get('fileName') || 'downloaded_file';

  try {
    // 1. Direct Binary File Download Stream (Zero-RAM buffer stream pipe with Resumable Range support)
    if (action === 'download' && fileId) {
      // Check expiration in DB
      try {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/transfers?file_path=eq.${fileId}&select=expires_at`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        });
        if (checkRes.ok) {
          const rows = await checkRes.json();
          if (rows && rows.length > 0 && new Date() > new Date(rows[0].expires_at)) {
            deleteDriveFile(fileId).catch(() => {});
            return res.status(410).json({ error: 'This transfer has expired and files have been permanently purged.' });
          }
        }
      } catch (e) {}

      const rangeHeader = req.headers['range'] || null;
      const streamRes = await getDriveFileStream(fileId, rangeHeader);
      if (!streamRes.ok && streamRes.status !== 206) {
        return res.status(streamRes.status).json({ error: 'File not available or has expired' });
      }

      let contentType = streamRes.headers.get('content-type') || '';
      if (!contentType || contentType.includes('octet-stream')) {
        contentType = getMimeType(fileName, 'application/octet-stream');
      }
      const contentLength = streamRes.headers.get('content-length');
      const contentRange = streamRes.headers.get('content-range');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      const statusCode = streamRes.status === 206 ? 206 : 200;
      res.status(statusCode);

      if (streamRes.body) {
        return Readable.fromWeb(streamRes.body).pipe(res);
      } else {
        return res.end();
      }
    }

    // 2. Direct Binary File Inline Preview Stream (Videos, Audio, Images, PDFs with seeking)
    if (action === 'stream' && fileId) {
      const rangeHeader = req.headers['range'] || null;
      const streamRes = await getDriveFileStream(fileId, rangeHeader);
      if (!streamRes.ok && streamRes.status !== 206) {
        return res.status(streamRes.status).json({ error: 'Preview stream unavailable' });
      }

      let contentType = streamRes.headers.get('content-type') || '';
      if (!contentType || contentType.includes('octet-stream')) {
        contentType = getMimeType(fileName, 'image/jpeg');
      }
      const contentLength = streamRes.headers.get('content-length');
      const contentRange = streamRes.headers.get('content-range');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      const statusCode = streamRes.status === 206 ? 206 : 200;
      res.status(statusCode);

      if (streamRes.body) {
        return Readable.fromWeb(streamRes.body).pipe(res);
      } else {
        return res.end();
      }
    }

    // 3. Query Upload Offset for Pause / Resume Recovery
    if (action === 'query-offset') {
      const uploadUrl = req.headers['x-session-url'] || urlObj.searchParams.get('sessionUrl');
      const fileSize = Number(urlObj.searchParams.get('fileSize') || 0);

      if (!uploadUrl) {
        return res.status(400).json({ error: 'sessionUrl required' });
      }

      const offset = await queryDriveUploadOffset(uploadUrl, fileSize);
      return res.status(200).json({ offset, complete: offset >= fileSize && fileSize > 0 });
    }

    // 4. Live Storage Quota Stats
    if (action === 'stats' || (req.method === 'GET' && !action)) {
      const stats = await getDriveStorageStats();
      if (!stats) return res.status(500).json({ error: 'Unable to fetch storage stats' });

      const limit = Number(stats.storageQuota?.limit || 5497558138880);
      const usage = Number(stats.storageQuota?.usage || 0);

      return res.status(200).json({
        usedBytes: usage,
        totalBytes: limit,
        availableBytes: Math.max(0, limit - usage),
        providerName: 'iTransfer 5 TB Cloud Vault',
      });
    }

    // 5. Automated Server-Side Expiration Cleanup Background Job
    if (action === 'cleanup') {
      const nowIso = new Date().toISOString();
      try {
        // Query expired transfers from Supabase
        const supRes = await fetch(`${SUPABASE_URL}/rest/v1/transfers?expires_at=lte.${nowIso}&select=*`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        });

        if (!supRes.ok) {
          return res.status(500).json({ error: 'Failed to query expired transfers' });
        }

        const expiredRows = await supRes.json();
        let deletedFilesCount = 0;
        let deletedTransfersCount = 0;

        for (const row of expiredRows) {
          if (row.file_path && !row.file_path.includes('/')) {
            try {
              await deleteDriveFile(row.file_path);
              deletedFilesCount++;
            } catch (e) {}
          }
        }

        // Auto-purge any leftover empty transfer folders across Drive hierarchy
        let deletedFoldersCount = 0;
        try {
          deletedFoldersCount = await purgeEmptyTransferFolders();
        } catch (e) {}

        // Delete expired records from Supabase
        if (expiredRows.length > 0) {
          const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/transfers?expires_at=lte.${nowIso}`, {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          });
          if (deleteRes.ok) {
            deletedTransfersCount = expiredRows.length;
          }
        }

        return res.status(200).json({
          success: true,
          deletedTransfers: deletedTransfersCount,
          deletedFiles: deletedFilesCount,
          deletedFolders: deletedFoldersCount,
          timestamp: nowIso,
        });
      } catch (err) {
        console.error('Cleanup error:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // Parse JSON body for mutation actions
    const rawBuffer = await getRawBody(req);
    let jsonBody = {};
    if (rawBuffer.length > 0 && req.headers['content-type']?.includes('application/json')) {
      try {
        jsonBody = JSON.parse(rawBuffer.toString('utf-8'));
      } catch (e) {}
    }

    // 6. Secure Password Verification
    if (action === 'verify-password') {
      const { shareId: sId, inputPassword, expectedPasswordHash } = jsonBody;
      if (!sId || !inputPassword) {
        return res.status(400).json({ error: 'shareId and inputPassword required' });
      }

      const isMatch = (inputPassword === expectedPasswordHash);
      if (!isMatch) {
        await new Promise(r => setTimeout(r, 200));
        return res.status(401).json({ error: 'Incorrect password. Access denied.' });
      }

      const authToken = generateDownloadToken(sId);
      return res.status(200).json({
        success: true,
        authToken,
        expiresIn: 3600,
      });
    }

    // 7. Initialize Hierarchical Resumable Upload Session
    if (action === 'init') {
      const {
        fileName,
        contentType,
        fileSize,
        shareId,
        isGuest,
        guestId,
        userDisplayName,
        transferName,
        expiryHours,
      } = jsonBody;

      if (!fileName || !shareId) {
        return res.status(400).json({ error: 'fileName and shareId required' });
      }

      const session = await createDriveUploadSession({
        fileName,
        contentType,
        fileSize,
        shareId,
        isGuest: isGuest !== false,
        guestId: guestId || 'Guest-General',
        userDisplayName,
        transferName,
        expiryHours: expiryHours ?? 168,
      });

      return res.status(200).json(session);
    }

    // 8. Forward Chunk to Google Drive
    if (action === 'chunk') {
      const sessionUrl = req.headers['x-session-url'] || urlObj.searchParams.get('sessionUrl');
      const rangeHeader = req.headers['content-range'] || urlObj.searchParams.get('range');
      const contentType = req.headers['x-file-type'] || 'application/octet-stream';

      if (!sessionUrl || !rangeHeader) {
        return res.status(400).json({ error: 'sessionUrl and content-range header required' });
      }

      const chunkResult = await uploadDriveChunk({
        uploadUrl: sessionUrl,
        chunkBuffer: rawBuffer,
        rangeHeader,
        contentType,
      });

      return res.status(200).json(chunkResult);
    }

    // 9. Finalize File Permissions & CDN Links
    if (action === 'finalize') {
      const fId = jsonBody.fileId || fileId;
      if (!fId) return res.status(400).json({ error: 'fileId required' });
      const fileMeta = await finalizeDriveFile(fId);
      return res.status(200).json({ success: true, file: fileMeta });
    }

    // 10. Rename Transfer Folder in Google Drive
    if (action === 'rename-transfer') {
      const { folderId, newName } = jsonBody;
      if (!folderId || !newName) {
        return res.status(400).json({ error: 'folderId and newName required' });
      }
      const ok = await renameDriveItem(folderId, newName);
      return res.status(200).json({ success: ok });
    }

    // 11. Delete File or Transfer Folder
    if (action === 'delete') {
      const fId = jsonBody.fileId || fileId;
      const fFolderId = jsonBody.folderId;
      if (fFolderId) {
        await deleteDriveFolder(fFolderId);
      }
      if (fId) {
        await deleteDriveFile(fId);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action parameter' });
  } catch (err) {
    console.error('Drive API error:', err);
    return res.status(500).json({ error: err.message || 'Internal Drive error' });
  }
}
