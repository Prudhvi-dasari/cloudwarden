/**
 * Cloudflare R2 transfer engine
 * - Small files: single presigned PUT
 * - Large files: parallel multipart (4–6 parts at once)
 * - Throttled UI progress so the bar stays smooth
 */

import { sanitizeStoragePath } from './storageProvider';

const SINGLE_PUT_MAX = 8 * 1024 * 1024; // 8 MB
const PART_SIZE = 16 * 1024 * 1024; // 16 MB parts (S3/R2 minimum is 5 MB except last)
const PARALLEL_PARTS = 5;
const UI_THROTTLE_MS = 80;

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatTime(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function xhrPut(url, blob, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.timeout = 45 * 60 * 1000;

    const abort = () => {
      try { xhr.abort(); } catch {}
    };
    if (signal) {
      if (signal.aborted) {
        abort();
        reject(new Error('aborted'));
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
    }

    xhr.upload.onprogress = (e) => {
      if (onProgress) onProgress(e.loaded, e.lengthComputable ? e.total : blob.size);
    };

    xhr.onload = () => {
      if (signal) signal.removeEventListener('abort', abort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          etag: xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag'),
          status: xhr.status,
        });
      } else {
        reject(new Error(`Upload HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', abort);
      reject(new Error('Network error during upload'));
    };

    xhr.onabort = () => {
      if (signal) signal.removeEventListener('abort', abort);
      reject(new Error('aborted'));
    };

    xhr.ontimeout = () => {
      if (signal) signal.removeEventListener('abort', abort);
      reject(new Error('Upload timed out'));
    };

    // Do not set Content-Type — keeps SigV4 query auth reliable for R2.
    xhr.send(blob);
  });
}

export class TransferManager {
  constructor(options = {}) {
    this.shareId = options.shareId || 'general';
    this.transferName = options.transferName || '';
    this.expiryHours = options.expiryHours ?? 168;
    this.isGuest = options.isGuest !== false;
    this.guestId = options.guestId || 'Guest-General';
    this.userDisplayName = options.userDisplayName || null;
    this.concurrency = options.concurrency || 2;
    this.apiBase = options.apiBase || '/api/r2';
    this.userPlan = options.userPlan || 'free';
    this.password = options.password || '';
    this.senderEmail = options.senderEmail || null;
    this.transferType = options.transferType || 'link';
    this.partConcurrency = options.partConcurrency || PARALLEL_PARTS;

    this.files = [];
    this.listeners = new Map();
    this.isRunning = false;
    this._uiTimer = null;
    this._uiDirty = false;

    this.handleOffline = () => {
      this.pauseAll();
      this.emit('networkOffline', true);
    };
    this.handleOnline = () => {
      this.emit('networkOnline', true);
      this.resumeAll();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', this.handleOffline);
      window.addEventListener('online', this.handleOnline);
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('offline', this.handleOffline);
      window.removeEventListener('online', this.handleOnline);
    }
    if (this._uiTimer) clearTimeout(this._uiTimer);
    this.cancelAll();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const list = this.listeners.get(event);
    if (list) this.listeners.set(event, list.filter((cb) => cb !== callback));
  }

  emit(event, data) {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const cb of list) {
      try { cb(data); } catch (e) { console.error(e); }
    }
  }

  /** Emit stateChanged at most ~12fps so React can paint the bar. */
  emitProgress() {
    this._uiDirty = true;
    if (this._uiTimer) return;
    this._uiTimer = setTimeout(() => {
      this._uiTimer = null;
      if (!this._uiDirty) return;
      this._uiDirty = false;
      const snap = this.getSnapshot();
      this.emit('fileProgress', snap);
      this.emit('stateChanged', snap);
    }, UI_THROTTLE_MS);
  }

  flushProgress() {
    if (this._uiTimer) {
      clearTimeout(this._uiTimer);
      this._uiTimer = null;
    }
    this._uiDirty = false;
    this.emit('stateChanged', this.getSnapshot());
  }

  addFiles(rawFiles) {
    const newItems = Array.from(rawFiles).map((file, idx) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${idx}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      status: 'queued',
      progress: 0,
      uploadedBytes: 0,
      speed: 0,
      speedStr: '-- MB/s',
      timeRemainingStr: '--:--',
      fileId: null,
      error: null,
      abortController: null,
      xhrs: [],
      startTime: null,
      partBytes: null,
    }));

    this.files.push(...newItems);
    this.emit('filesChanged', this.getSnapshot());
    if (this.isRunning) this.processQueue();
    return newItems;
  }

  _abortItem(item) {
    if (item.abortController) {
      try { item.abortController.abort(); } catch {}
      item.abortController = null;
    }
    if (Array.isArray(item.xhrs)) {
      for (const xhr of item.xhrs) {
        try { xhr.abort(); } catch {}
      }
      item.xhrs = [];
    }
  }

  removeFile(fileId) {
    const item = this.files.find((f) => f.id === fileId);
    if (item) this._abortItem(item);
    this.files = this.files.filter((f) => f.id !== fileId);
    this.flushProgress();
    this.processQueue();
  }

  pauseFile(fileId) {
    const item = this.files.find((f) => f.id === fileId);
    if (item && item.status === 'uploading') {
      item.status = 'paused';
      this._abortItem(item);
      this.flushProgress();
      this.processQueue();
    }
  }

  resumeFile(fileId) {
    const item = this.files.find((f) => f.id === fileId);
    if (item && item.status === 'paused') {
      item.status = 'queued';
      item.error = null;
      this.flushProgress();
      this.processQueue();
    }
  }

  retryFile(fileId) {
    const item = this.files.find((f) => f.id === fileId);
    if (item && item.status === 'error') {
      item.status = 'queued';
      item.error = null;
      item.progress = 0;
      item.uploadedBytes = 0;
      item.speed = 0;
      item.partBytes = null;
      this.flushProgress();
      this.processQueue();
    }
  }

  pauseAll() {
    this.isRunning = false;
    this.files.forEach((f) => {
      if (f.status === 'uploading' || f.status === 'queued') {
        f.status = 'paused';
        this._abortItem(f);
      }
    });
    this.flushProgress();
  }

  resumeAll() {
    this.isRunning = true;
    this.files.forEach((f) => {
      if (f.status === 'paused') f.status = 'queued';
    });
    this.flushProgress();
    this.processQueue();
  }

  cancelFile(fileId) {
    const item = this.files.find((f) => f.id === fileId);
    if (!item) return;
    item.status = 'cancelled';
    this._abortItem(item);
    this.flushProgress();
    this.processQueue();
  }

  cancelAll() {
    this.isRunning = false;
    this.files.forEach((f) => {
      if (['uploading', 'queued', 'paused'].includes(f.status)) {
        f.status = 'cancelled';
        this._abortItem(f);
      }
    });
    this.flushProgress();
  }

  start() {
    this.isRunning = true;
    this._openAndRun();
  }

  async _openAndRun() {
    try {
      await this._openTransfer();
      this.processQueue();
    } catch (err) {
      this.isRunning = false;
      this.files.forEach((file) => {
        if (file.status === 'queued' || file.status === 'uploading') {
          file.status = 'error';
          file.error = err?.message || 'Could not start this transfer.';
        }
      });
      this.flushProgress();
    }
  }

  async _openTransfer() {
    if (this.deleteToken && this.claimToken) return;
    const data = await this._api('open-transfer', {
      shareId: this.shareId,
      expiryHours: this.expiryHours,
      subject: this.transferName,
      senderEmail: this.senderEmail || null,
      guestId: this.guestId || null,
      transferType: this.transferType || 'link',
    });
    this.claimToken = data.claimToken;
    this.deleteToken = data.deleteToken;
    this.expiresAt = data.expiresAt;
    if (data.shareId) this.shareId = data.shareId;
  }

  processQueue() {
    if (!this.isRunning) return;

    const uploadingCount = this.files.filter((f) => f.status === 'uploading').length;
    const slots = this.concurrency - uploadingCount;
    if (slots <= 0) return;

    const queued = this.files.filter((f) => f.status === 'queued').slice(0, slots);
    for (const item of queued) {
      this.uploadSingleFile(item);
    }

    const active = this.files.some((f) => ['uploading', 'queued', 'paused'].includes(f.status));
    const allSettled = this.files.length > 0 && this.files.every((f) =>
      f.status === 'completed' || f.status === 'cancelled' || f.status === 'error'
    );

    if (!active && allSettled) {
      const hasSuccess = this.files.some((f) => f.status === 'completed');
      this.flushProgress();
      if (hasSuccess) this.emit('transferComplete', this.getSnapshot());
    }
  }

  _updateItemProgress(item, loaded) {
    const totalSize = item.size || 1;
    const now = performance.now();
    if (!item._lastTick) {
      item._lastTick = now;
      item._lastLoaded = loaded;
    }

    const dt = (now - item._lastTick) / 1000;
    if (dt >= 0.15) {
      const instant = Math.max(0, (loaded - item._lastLoaded) / dt);
      item.speed = item.speed > 0 ? item.speed * 0.55 + instant * 0.45 : instant;
      item._lastTick = now;
      item._lastLoaded = loaded;
    }

    item.uploadedBytes = Math.min(totalSize, loaded);
    item.progress = Math.min(99, Math.round((item.uploadedBytes / totalSize) * 100));
    const speed = item.speed > 0
      ? item.speed
      : item.uploadedBytes / Math.max(0.2, (Date.now() - item.startTime) / 1000);
    item.speedStr = `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
    item.timeRemainingStr = formatTime(
      speed > 0 ? Math.max(0, totalSize - item.uploadedBytes) / speed : 0
    );
    this.emitProgress();
  }

  async _api(action, body) {
    const res = await fetch(`${this.apiBase}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `API ${action} failed (${res.status})`);
    return data;
  }

  async uploadSingleFile(item) {
    item.status = 'uploading';
    item.startTime = Date.now();
    item.abortController = new AbortController();
    item.partBytes = null;
    item.error = null;
    this.flushProgress();

    const signal = item.abortController.signal;
    const totalSize = item.size;

    try {
      if (totalSize <= SINGLE_PUT_MAX) {
        await this._uploadSinglePut(item, signal);
      } else {
        await this._uploadMultipart(item, signal);
      }

      if (item.status === 'paused' || item.status === 'cancelled') return;

      item.status = 'completed';
      item.progress = 100;
      item.uploadedBytes = totalSize;
      item.speedStr = 'Ready';
      item.timeRemainingStr = '00:00';
      this.emit('fileComplete', item);
      this.flushProgress();
      this.processQueue();
    } catch (err) {
      if (item.status === 'paused' || item.status === 'cancelled') return;
      if (err?.message === 'aborted') return;

      console.error('Upload failed:', err);
      item.status = 'error';
      item.error = err?.message || 'Upload failed. Tap Retry.';
      this.emit('fileError', { item, error: err });
      this.flushProgress();
      this.processQueue();
    }
  }

  async _uploadSinglePut(item, signal) {
    const data = await this._api('get-put-url', {
      fileName: item.name,
      fileSize: item.size,
      contentType: item.type || 'application/octet-stream',
      deleteToken: this.deleteToken,
      shareId: this.shareId,
      password: this.password || undefined,
      subject: this.transferName,
      senderEmail: this.senderEmail || null,
      transferType: this.transferType || 'link',
    });

    if (!data.presignedUrl) throw new Error('No upload URL from Cloudflare R2');

    await xhrPut(data.presignedUrl, item.file, {
      signal,
      onProgress: (loaded) => {
        if (item.status === 'uploading') this._updateItemProgress(item, loaded);
      },
    });

    await this._api('finalize-upload', { s3Key: data.s3Key, deleteToken: this.deleteToken });
    item.fileId = data.s3Key;
    item.serverRecorded = true;
  }

  async _uploadMultipart(item, signal) {
    const init = await this._api('initiate-upload', {
      fileName: item.name,
      fileSize: item.size,
      contentType: item.type || 'application/octet-stream',
      deleteToken: this.deleteToken,
      shareId: this.shareId,
      password: this.password || undefined,
      transferType: this.transferType || 'link',
    });

    if (!init.uploadId || !init.s3Key) {
      throw new Error('Could not start multipart upload');
    }

    const { uploadId, s3Key } = init;
    const totalSize = item.size;
    const partCount = Math.ceil(totalSize / PART_SIZE) || 1;
    item.partBytes = new Array(partCount).fill(0);
    const completedParts = new Array(partCount);

    const refreshAggregate = () => {
      const loaded = item.partBytes.reduce((a, b) => a + b, 0);
      if (item.status === 'uploading') this._updateItemProgress(item, loaded);
    };

    const urlCache = new Map();

    const ensureUrls = async (fromIndex, count) => {
      const needed = [];
      for (let i = fromIndex; i < Math.min(fromIndex + count, partCount); i += 1) {
        const partNumber = i + 1;
        if (!urlCache.has(partNumber)) needed.push(partNumber);
      }
      if (needed.length === 0) return;
      const batch = await this._api('get-part-urls', {
        s3Key,
        uploadId,
        partNumbers: needed,
        deleteToken: this.deleteToken,
      });
      for (const part of batch.parts || []) {
        urlCache.set(part.partNumber, part.presignedUrl);
      }
    };

    // Prefetch first wave of part URLs in one API round-trip
    await ensureUrls(0, this.partConcurrency);

    let nextPart = 0;
    const workers = Array.from({ length: Math.min(this.partConcurrency, partCount) }, async () => {
      while (nextPart < partCount) {
        if (signal.aborted || item.status !== 'uploading') throw new Error('aborted');

        const partIndex = nextPart;
        nextPart += 1;
        const partNumber = partIndex + 1;
        const start = partIndex * PART_SIZE;
        const end = Math.min(start + PART_SIZE, totalSize);
        const blob = item.file.slice(start, end);

        // Keep the URL pipeline ahead of active uploads
        ensureUrls(nextPart, this.partConcurrency).catch(() => {});

        if (!urlCache.has(partNumber)) await ensureUrls(partIndex, 1);
        let presignedUrl = urlCache.get(partNumber);
        if (!presignedUrl) throw new Error(`Missing URL for part ${partNumber}`);

        let attempt = 0;
        while (attempt < 3) {
          try {
            if (signal.aborted || item.status !== 'uploading') throw new Error('aborted');
            if (attempt > 0) {
              const fresh = await this._api('get-part-url', { s3Key, uploadId, partNumber, deleteToken: this.deleteToken });
              presignedUrl = fresh.presignedUrl;
            }

            const result = await xhrPut(presignedUrl, blob, {
              signal,
              onProgress: (loaded) => {
                item.partBytes[partIndex] = loaded;
                refreshAggregate();
              },
            });

            let etag = result.etag;
            if (!etag) {
              throw new Error('Missing ETag — R2 CORS must expose ETag');
            }
            etag = etag.replaceAll('&quot;', '"');
            if (!etag.startsWith('"')) etag = `"${etag.replaceAll('"', '')}"`;
            completedParts[partIndex] = { PartNumber: partNumber, ETag: etag };
            item.partBytes[partIndex] = end - start;
            refreshAggregate();
            break;
          } catch (err) {
            if (err?.message === 'aborted') throw err;
            attempt += 1;
            if (attempt >= 3) throw err;
            await new Promise((r) => setTimeout(r, 350 * attempt));
          }
        }
      }
    });

    await Promise.all(workers);

    const parts = completedParts.filter(Boolean);
    if (parts.length !== partCount) {
      throw new Error('Multipart upload incomplete');
    }

    await this._api('complete-upload', { s3Key, uploadId, parts, deleteToken: this.deleteToken });
    item.fileId = s3Key;
    item.serverRecorded = true;
  }

  getSnapshot() {
    const totalFiles = this.files.length;
    const completedFiles = this.files.filter((f) => f.status === 'completed').length;
    const uploadingFiles = this.files.filter((f) => f.status === 'uploading').length;
    const queuedFiles = this.files.filter((f) => f.status === 'queued').length;
    const pausedFiles = this.files.filter((f) => f.status === 'paused').length;
    const errorFiles = this.files.filter((f) => f.status === 'error').length;

    const totalBytes = this.files.reduce((acc, f) => acc + (f.size || 0), 0);
    const totalUploadedBytes = this.files.reduce((acc, f) => {
      if (f.status === 'completed') return acc + (f.size || 0);
      return acc + (f.uploadedBytes || 0);
    }, 0);

    const overallProgress = totalBytes > 0
      ? Math.min(100, Math.round((totalUploadedBytes / totalBytes) * 100))
      : 0;

    const aggregateSpeed = this.files
      .filter((f) => f.status === 'uploading')
      .reduce((acc, f) => acc + (f.speed || 0), 0);

    const speedStr = aggregateSpeed > 0
      ? `${(aggregateSpeed / (1024 * 1024)).toFixed(1)} MB/s`
      : '-- MB/s';

    const remainingBytes = Math.max(0, totalBytes - totalUploadedBytes);
    const etaSeconds = aggregateSpeed > 0 ? remainingBytes / aggregateSpeed : 0;

    const isAllComplete = completedFiles === totalFiles && totalFiles > 0;

    let overallStatus = 'idle';
    if (this.isRunning) {
      if (uploadingFiles > 0 || queuedFiles > 0) overallStatus = 'uploading';
      else if (pausedFiles > 0) overallStatus = 'paused';
      else if (errorFiles > 0 && !uploadingFiles && !queuedFiles) overallStatus = 'error';
      else if (isAllComplete) overallStatus = 'complete';
    } else if (pausedFiles > 0) overallStatus = 'paused';
    else if (isAllComplete) overallStatus = 'complete';
    else if (errorFiles > 0) overallStatus = 'error';

    const active = this.files.find((f) => f.status === 'uploading')
      || this.files.find((f) => f.status === 'queued');

    return {
      shareId: this.shareId,
      transferName: this.transferName,
      isAllComplete,
      totalFiles,
      completedFiles,
      uploadingFiles,
      queuedFiles,
      pausedFiles,
      errorFiles,
      totalBytes,
      totalUploadedBytes,
      uploadedBytes: totalUploadedBytes, // alias for older UI
      totalBytesStr: formatBytes(totalBytes),
      totalUploadedBytesStr: formatBytes(totalUploadedBytes),
      overallProgress,
      aggregateSpeed,
      speedStr,
      etaSeconds,
      timeRemainingStr: formatTime(etaSeconds),
      overallStatus,
      activeFileName: active?.name || '',
      files: this.files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        sizeStr: formatBytes(f.size),
        type: f.type,
        status: f.status,
        progress: f.progress,
        uploadedBytes: f.status === 'completed' ? f.size : f.uploadedBytes,
        uploadedBytesStr: formatBytes(f.status === 'completed' ? f.size : f.uploadedBytes),
        speed: f.speed,
        speedStr: f.speedStr,
        timeRemainingStr: f.timeRemainingStr,
        fileId: f.fileId,
        serverRecorded: Boolean(f.serverRecorded),
        error: f.error,
      })),
    };
  }
}

// Keep path helper available for callers that still import it here
export { sanitizeStoragePath };
