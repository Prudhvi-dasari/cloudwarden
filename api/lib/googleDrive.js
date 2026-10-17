/**
 * Google Drive Storage Backend for iTransfer
 * 
 * Implements the Enterprise Hierarchical Folder Structure:
 * iTransfer/
 * ├── Guests/
 * │   └── Guest-X7K92/
 * │       ├── Transfer-A82F/
 * │       └── Transfer-K91P/
 * └── Users/
 *     └── Prudhvi/
 *         ├── Hi-Tech Video/
 *         └── Client Assets/
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
const VAULT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

let cachedAccessToken = null;
let tokenExpiresAt = 0;

// In-memory folder ID cache to minimize Google Drive API roundtrips
const folderCache = new Map();

/**
 * Get a valid OAuth2 Access Token, auto-refreshing if expired
 */
export async function getGoogleAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt > now + 60000) {
    return cachedAccessToken;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to refresh Google OAuth token: ${errText}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

/**
 * Find or create a folder in Google Drive by name within a parent folder
 */
export async function getOrCreateFolder(folderName, parentFolderId = null) {
  const cleanName = (folderName || 'General').trim().replace(/['"\\]/g, '');
  const cacheKey = `${parentFolderId || 'root'}:${cleanName}`;

  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey);
  }

  const token = await getGoogleAccessToken();

  let q = `name = '${cleanName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    q += ` and '${parentFolderId}' in parents`;
  }

  // 1. Search for existing folder
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (searchRes.ok) {
    const sData = await searchRes.json();
    if (sData.files && sData.files.length > 0) {
      const fId = sData.files[0].id;
      folderCache.set(cacheKey, fId);
      return fId;
    }
  }

  // 2. Create folder if not found
  let createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: cleanName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : [],
    }),
  });

  // If parent folder ID was not found (404), fallback to root folder automatically
  if (!createRes.ok && parentFolderId) {
    console.warn(`Parent folder ${parentFolderId} not found. Creating in Drive root...`);
    createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: cleanName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [],
      }),
    });
  }

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder [${cleanName}]: ${errText}`);
  }

  const cData = await createRes.json();
  folderCache.set(cacheKey, cData.id);
  return cData.id;
}

/**
 * Resolve the full Hierarchical Google Drive folder target for a transfer
 * 
 * Structure:
 * If Guest -> iTransfer/Guests/Guest-XXXXX/TransferName/
 * If User  -> iTransfer/Users/DisplayName/TransferName/
 */
export async function resolveTransferTargetFolder({ isGuest = true, guestId, userDisplayName, transferName, shareId }) {
  // 1. Root 'iTransfer' folder
  const rootId = await getOrCreateFolder('iTransfer', VAULT_FOLDER_ID);

  let categoryFolderId;
  let ownerFolderId;

  if (isGuest || !userDisplayName) {
    // Guest Branch
    categoryFolderId = await getOrCreateFolder('Guests', rootId);
    const safeGuestId = (guestId && guestId.startsWith('Guest-')) ? guestId : 'Guest-General';
    ownerFolderId = await getOrCreateFolder(safeGuestId, categoryFolderId);
  } else {
    // Registered User Branch (use clean display/first name, never email)
    categoryFolderId = await getOrCreateFolder('Users', rootId);
    const safeUserName = userDisplayName.trim().replace(/[<>:"/\\|?*]/g, '') || 'User';
    ownerFolderId = await getOrCreateFolder(safeUserName, categoryFolderId);
  }

  // Transfer Subfolder (e.g. 'Hi-Tech Video' or 'Transfer-A82F')
  const finalTransferName = (transferName && transferName.trim()) 
    ? transferName.trim().replace(/[<>:"/\\|?*]/g, '')
    : `Transfer-${(shareId || 'general').slice(0, 6).toUpperCase()}`;

  const transferFolderId = await getOrCreateFolder(finalTransferName, ownerFolderId);

  return {
    transferFolderId,
    folderPath: isGuest ? `Guests/${guestId}/${finalTransferName}` : `Users/${userDisplayName}/${finalTransferName}`,
    transferName: finalTransferName,
  };
}

/**
 * Initialize a Google Drive Resumable Upload Session inside the target Transfer Folder
 */
export async function createDriveUploadSession({
  fileName,
  contentType,
  fileSize,
  shareId,
  isGuest = true,
  guestId,
  userDisplayName,
  transferName,
  expiryHours = 168,
}) {
  const token = await getGoogleAccessToken();

  // Resolve hierarchical target folder
  const { transferFolderId, folderPath, transferName: resolvedName } = await resolveTransferTargetFolder({
    isGuest,
    guestId,
    userDisplayName,
    transferName,
    shareId,
  });

  const metadata = {
    name: fileName,
    parents: [transferFolderId],
    description: `iTransfer [${resolvedName}] (Share: ${shareId}, Path: ${folderPath}, Expiry: ${expiryHours}h)`,
  };

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType || 'application/octet-stream',
      'X-Upload-Content-Length': String(fileSize || 0),
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to initiate Google Drive upload session: ${errText}`);
  }

  const uploadUrl = res.headers.get('location');
  return {
    uploadUrl,
    transferFolderId,
    folderPath,
    transferName: resolvedName,
  };
}

/**
 * Query current byte offset from Google Drive for an interrupted/paused upload session
 * Returns the exact byte number to resume from.
 */
export async function queryDriveUploadOffset(uploadUrl, totalSize) {
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes */${totalSize}`,
      },
    });

    if (res.status === 308) {
      const range = res.headers.get('range');
      if (range) {
        const match = range.match(/bytes=0-(\d+)/);
        if (match && match[1]) {
          return Number(match[1]) + 1;
        }
      }
      return 0;
    }

    if (res.status === 200 || res.status === 201) {
      return totalSize; // Already complete
    }

    return 0;
  } catch (e) {
    console.warn('Query offset error:', e);
    return 0;
  }
}

/**
 * Forward a binary chunk to Google Drive Resumable Upload Session
 */
export async function uploadDriveChunk({ uploadUrl, chunkBuffer, rangeHeader, contentType }) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Range': rangeHeader,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: chunkBuffer,
  });

  if (res.status === 308) {
    return { status: 308, complete: false, range: res.headers.get('range') };
  }

  if (res.status === 200 || res.status === 201) {
    const fileData = await res.json();
    if (fileData?.id) {
      finalizeDriveFile(fileData.id).catch(() => {});
    }
    return { status: 200, complete: true, file: fileData };
  }

  const errText = await res.text();
  throw new Error(`Google Drive chunk upload error [${res.status}]: ${errText}`);
}

/**
 * Stream binary content from Google Drive with optional Range header
 */
export async function getDriveFileStream(fileId, rangeHeader = null) {
  const token = await getGoogleAccessToken();
  const headers = { 'Authorization': `Bearer ${token}` };
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers,
  });
  return res;
}

/**
 * Get file metadata from Google Drive
 */
export async function getDriveFileMetadata(fileId) {
  const token = await getGoogleAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,size,mimeType,webContentLink,webViewLink,thumbnailLink,parents`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Set public permission on file
 */
export async function finalizeDriveFile(fileId) {
  const token = await getGoogleAccessToken();
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (e) {
    console.warn('Permission set warning:', e);
  }

  return await getDriveFileMetadata(fileId);
}

/**
 * Rename a folder or file in Google Drive
 */
export async function renameDriveItem(itemId, newName) {
  const token = await getGoogleAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });
  return res.ok;
}

/**
 * Delete a file or folder from Google Drive, and auto-delete empty parent transfer folder
 */
export async function deleteDriveFile(fileId) {
  const token = await getGoogleAccessToken();
  let parentFolderId = null;

  try {
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      parentFolderId = meta.parents?.[0] || null;
    }
  } catch (e) {}

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  // Check if parent folder is now empty and delete it
  if (parentFolderId) {
    try {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${parentFolderId}'+in+parents+and+trashed=false&fields=files(id)`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.files && checkData.files.length === 0) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${parentFolderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        }
      }
    } catch (e) {}
  }

  return res.ok || res.status === 404;
}

/**
 * Delete a folder and its contents
 */
export async function deleteDriveFolder(folderId) {
  return await deleteDriveFile(folderId);
}

/**
 * Purge all empty transfer folders across Guests and Users hierarchy
 */
export async function purgeEmptyTransferFolders() {
  const token = await getGoogleAccessToken();
  let purgedCount = 0;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'+and+trashed=false&pageSize=100&fields=files(id,name,parents)`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return 0;
    const { files = [] } = await res.json();

    for (const folder of files) {
      if (['iTransfer', 'Guests', 'Users', 'iTransfer_Vault', '1_Hour', '24_Hours', '3_Days', '7_Days', '30_Days', '1_Year', 'Permanent'].includes(folder.name)) continue;

      const childrenRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folder.id}'+in+parents+and+trashed=false&fields=files(id)`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (childrenRes.ok) {
        const { files: children = [] } = await childrenRes.json();
        if (children.length === 0) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${folder.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          purgedCount++;
        }
      }
    }
  } catch (e) {
    console.warn('Purge empty folders warning:', e);
  }

  return purgedCount;
}

/**
 * Get Google One Storage Quota Stats
 */
export async function getDriveStorageStats() {
  const token = await getGoogleAccessToken();
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.json();
}
