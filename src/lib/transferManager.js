/**
 * Cloudflare R2 transfer engine
 * - Small files: single presigned PUT
 * - Large files: parallel multipart (4–6 parts at once)
 * - Throttled UI progress so the bar stays smooth
 */

import { sanitizeStoragePath } from './storagePath.js';
import {
  PART_SIZE_BYTES,
  PART_UPLOAD_ATTEMPTS,
  bytesFromCompletedParts,
  isResumeNetworkError,
  normalizePartEtag,
  partByteLength,
  partUrlIsStale,
  partsStillNeeded,
} from './uploadPlan.js';
import { deleteUploadSession, saveUploadSession, snapshotFromManager } from './uploadPersistence.js';

function reportProductEvent(event) {
  fetch('/api/r2?action=event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

const SINGLE_PUT_MAX = 8 * 1024 * 1024; // 8 MB
const PART_SIZE = PART_SIZE_BYTES; // 16 MB parts (S3/R2 minimum is 5 MB except last)
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
    this.accessToken = options.accessToken || '';
    this.partSize = PART_SIZE;
    this.onPersist = null;
    if (options.deleteToken) this.deleteToken = options.deleteToken;
    if (options.claimToken) this.claimToken = options.claimToken;
    if (options.expiresAt) this.expiresAt = options.expiresAt;

    this.files = [];
    this.listeners = new Map();
    this.isRunning = false;
    this._uiTimer = null;
    this._uiDirty = false;

    this.handleOffline = () => {
      this.pauseAll({ network: true });
      this.emit('networkOffline', true);
    };
    this.handleOnline = () => {
      this.emit('networkOnline', true);
      this.resumeAll({ onlyNetwork: true });
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
      lastModified: file.lastModified || 0,
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
      item.speed = 0;
      this.flushProgress();
      this.processQueue();
    }
  }

  pauseAll({ network = false } = {}) {
    this.isRunning = false;
    this.files.forEach((f) => {
      if (f.status === 'uploading' || f.status === 'queued') {
        f.status = 'paused';
        f.pausedForNetwork = network;
        this._abortItem(f);
      }
    });
    this.flushProgress();
  }

  resumeAll({ onlyNetwork = false } = {}) {
    this.isRunning = true;
    this.files.forEach((f) => {
      if (f.status === 'paused' && (!onlyNetwork || f.pausedForNetwork)) {
        f.status = 'queued';
        f.pausedForNetwork = false;
      }
    });
    this.flushProgress();
    this.processQueue();
  }

  cancelFile(fileId) {
    const item = this.files.find((f) => f.id === fileId);
    if (!item) return;
    item.status = 'cancelled';
    this._abortItem(item);
    this._releaseRemote(item);
    this.flushProgress();
    this.processQueue();
  }

  cancelAll() {
    this.isRunning = false;
    this.files.forEach((f) => {
      if (['uploading', 'queued', 'paused'].includes(f.status)) {
        f.status = 'cancelled';
        this._abortItem(f);
        this._releaseRemote(f);
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
      reportProductEvent('upload_failed');
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

  async _authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    let token = '';
    try {
      token = typeof this.accessToken === 'function' ? await this.accessToken() : (this.accessToken || '');
    } catch {
      token = '';
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async _api(action, body) {
    const res = await fetch(`${this.apiBase}?action=${action}`, {
      method: 'POST',
      headers: await this._authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `API ${action} failed (${res.status})`);
    return data;
  }

  _releaseRemote(item) {
    if (!item?.uploadId || !item?.s3Key || !this.deleteToken || item.serverRecorded) return;
    const uploadId = item.uploadId;
    const s3Key = item.s3Key;
    item.uploadId = null;
    this._api('abort-upload', { s3Key, uploadId, deleteToken: this.deleteToken }).catch(() => {});
  }

  async remember() {
    const session = snapshotFromManager(this);
    if (!session) return;
    try {
      await saveUploadSession(session);
    } catch {
      // Resume memory is best-effort. The in-page retry still has the parts.
    }
    if (this.onPersist) this.onPersist();
  }

  async uploadSingleFile(item) {
    const resuming = Boolean(item.uploadId || item.s3Key || item.completedPartNumbers?.length);
    item.status = 'uploading';
    item.pausedForNetwork = false;
    item.startTime = item.startTime || Date.now();
    item.abortController = new AbortController();
    if (!resuming) item.partBytes = null;
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

      if (isResumeNetworkError(err) || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        item.status = 'paused';
        item.pausedForNetwork = true;
        item.error = null;
        this.flushProgress();
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          setTimeout(() => {
            if (item.status === 'paused' && item.pausedForNetwork) this.resumeFile(item.id);
          }, 1200);
        }
        return;
      }

      console.error('Upload failed:', err);
      item.status = 'error';
      item.error = err?.message || 'Upload stopped. Retry continues from the last finished part.';
      reportProductEvent('upload_failed');
      this.emit('fileError', { item, error: err });
      this.flushProgress();
      this.processQueue();
    }
  }

  async _uploadSinglePut(item, signal) {
    let data;
    if (item.s3Key && item.singlePut) {
      data = await this._api('refresh-put-url', {
        s3Key: item.s3Key,
        deleteToken: this.deleteToken,
      });
    } else {
      data = await this._api('get-put-url', {
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
      item.s3Key = data.s3Key;
      item.singlePut = true;
      await this.remember();
    }

    if (!data.presignedUrl) throw new Error('No upload URL from Cloudflare R2');

    await xhrPut(data.presignedUrl, item.file, {
      signal,
      onProgress: (loaded) => {
        if (item.status === 'uploading') this._updateItemProgress(item, loaded);
      },
    });

    await this._api('finalize-upload', { s3Key: data.s3Key || item.s3Key, deleteToken: this.deleteToken });
    item.fileId = data.s3Key || item.s3Key;
    item.serverRecorded = true;
    await this.forgetIfIdle(item);
  }

  async forgetIfIdle(item) {
    const stillOpen = this.files.some((file) => file !== item && !file.serverRecorded && file.status !== 'cancelled');
    if (!stillOpen) await deleteUploadSession(this.shareId);
  }

  async _uploadMultipart(item, signal) {
    if (!item.uploadId || !item.s3Key) {
      const init = await this._api('initiate-upload', {
        fileName: item.name,
        fileSize: item.size,
        contentType: item.type || 'application/octet-stream',
        deleteToken: this.deleteToken,
        shareId: this.shareId,
        password: this.password || undefined,
        transferType: this.transferType || 'link',
      });
      if (!init.uploadId || !init.s3Key) throw new Error('Could not start multipart upload');
      item.uploadId = init.uploadId;
      item.s3Key = init.s3Key;
      item.completedParts = item.completedParts || [];
      await this.remember();
    }

    const { uploadId, s3Key } = item;
    const totalSize = item.size;
    const partCount = Math.ceil(totalSize / PART_SIZE) || 1;
    const completedParts = new Array(partCount);
    const savedParts = Array.isArray(item.completedParts) ? item.completedParts : [];
    for (const part of savedParts) {
      const index = Number(part.partNumber) - 1;
      if (index >= 0 && index < partCount) completedParts[index] = { PartNumber: part.partNumber, ETag: part.etag || '' };
    }
    const done = new Set(completedParts.map((part, index) => (part ? index + 1 : 0)).filter(Boolean));
    item.completedPartNumbers = [...done];
    item.partBytes = Array.from({ length: partCount }, (_, index) => (
      done.has(index + 1) ? partByteLength(index + 1, totalSize, PART_SIZE) : 0
    ));
    item.uploadedBytes = bytesFromCompletedParts(totalSize, item.completedPartNumbers, PART_SIZE);

    try {
      const listed = await this._api('list-parts', { s3Key, uploadId, deleteToken: this.deleteToken });
      for (const part of listed.parts || []) {
        const index = Number(part.partNumber) - 1;
        if (index < 0 || index >= partCount) continue;
        completedParts[index] = { PartNumber: part.partNumber, ETag: part.etag || '' };
        done.add(part.partNumber);
        item.partBytes[index] = partByteLength(part.partNumber, totalSize, PART_SIZE);
      }
      item.completedParts = [...done].map((partNumber) => completedParts[partNumber - 1]).filter(Boolean);
      item.completedPartNumbers = [...done];
      await this.remember();
    } catch {
      // A missing list still lets new parts upload. Complete asks R2 again.
    }
    item.completedPartNumbers = [...done];

    const refreshAggregate = () => {
      const loaded = item.partBytes.reduce((a, b) => a + b, 0);
      if (item.status === 'uploading') this._updateItemProgress(item, loaded);
    };
    refreshAggregate();

    const urlCache = new Map();
    let urlChain = Promise.resolve();

    const ensureUrls = (fromIndex, count) => {
      const job = urlChain.then(async () => {
        const needed = [];
        for (let i = fromIndex; i < Math.min(fromIndex + count, partCount); i += 1) {
          const partNumber = i + 1;
          if (done.has(partNumber)) continue;
          const cached = urlCache.get(partNumber);
          if (!cached || partUrlIsStale(cached.issuedAt)) needed.push(partNumber);
        }
        if (needed.length === 0) return;
        const batch = await this._api('get-part-urls', {
          s3Key,
          uploadId,
          partNumbers: needed.slice(0, this.partConcurrency),
          deleteToken: this.deleteToken,
        });
        const issuedAt = Date.now();
        for (const part of batch.parts || []) {
          urlCache.set(part.partNumber, { url: part.presignedUrl, issuedAt });
        }
      });
      urlChain = job.catch(() => {});
      return job;
    };

    await ensureUrls(0, this.partConcurrency);

    let nextPart = 0;
    const workers = Array.from({ length: Math.min(this.partConcurrency, partCount) }, async () => {
      while (nextPart < partCount) {
        if (signal.aborted || item.status !== 'uploading') throw new Error('aborted');

        const partIndex = nextPart;
        nextPart += 1;
        const partNumber = partIndex + 1;
        if (!partsStillNeeded(partCount, [...done]).includes(partNumber)) continue;

        const start = partIndex * PART_SIZE;
        const end = Math.min(start + PART_SIZE, totalSize);
        const blob = item.file.slice(start, end);

        let attempt = 0;
        while (attempt < PART_UPLOAD_ATTEMPTS) {
          try {
            if (signal.aborted || item.status !== 'uploading') throw new Error('aborted');
            if (attempt === 0) await ensureUrls(partIndex, this.partConcurrency);
            let cached = urlCache.get(partNumber);
            if (attempt > 0 || !cached?.url || partUrlIsStale(cached.issuedAt)) {
              const fresh = await this._api('get-part-url', { s3Key, uploadId, partNumber, deleteToken: this.deleteToken });
              cached = { url: fresh.presignedUrl, issuedAt: Date.now() };
              urlCache.set(partNumber, cached);
            }
            if (!cached?.url) throw new Error(`Missing URL for part ${partNumber}`);

            const result = await xhrPut(cached.url, blob, {
              signal,
              onProgress: (loaded) => {
                item.partBytes[partIndex] = loaded;
                refreshAggregate();
              },
            });

            completedParts[partIndex] = { PartNumber: partNumber, ETag: normalizePartEtag(result.etag) };
            done.add(partNumber);
            item.completedPartNumbers = [...done];
            item.completedParts = [...done].map((number) => completedParts[number - 1]).filter(Boolean);
            item.partBytes[partIndex] = end - start;
            refreshAggregate();
            this.remember();
            break;
          } catch (err) {
            if (err?.message === 'aborted') throw err;
            attempt += 1;
            if (attempt >= PART_UPLOAD_ATTEMPTS) throw err;
            await new Promise((r) => setTimeout(r, 400 * attempt));
          }
        }
      }
    });

    await Promise.all(workers);

    const parts = completedParts.filter(Boolean);
    if (parts.length !== partCount) throw new Error('Multipart upload incomplete');

    await this._api('complete-upload', { s3Key, uploadId, parts, deleteToken: this.deleteToken });
    item.fileId = s3Key;
    item.serverRecorded = true;
    item.uploadId = null;
    await this.forgetIfIdle(item);
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
