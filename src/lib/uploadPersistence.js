/**
 * Resume records for an in-flight transfer.
 * The file bytes stay in the browser. We only keep the R2 upload id,
 * completed part numbers, and enough identity to match the same file later.
 */

import { bytesFromCompletedParts, partByteLength, partCountFor } from './uploadPlan.js';

const STORAGE_KEY = 'sta_upload_sessions_v1';
const DB_NAME = 'sendtoanyone-uploads';
const STORE = 'sessions';
export const RESUME_MAX_AGE_MS = 20 * 60 * 60 * 1000;

export function fileIdentity(file) {
  return {
    name: file?.name || '',
    size: Number(file?.size) || 0,
    lastModified: Number(file?.lastModified) || 0,
    type: file?.type || 'application/octet-stream',
  };
}

export function identitiesMatch(saved, file) {
  if (!saved || !file) return false;
  if (saved.name !== file.name || Number(saved.size) !== Number(file.size)) return false;
  const savedModified = Number(saved.lastModified || 0);
  const fileModified = Number(file.lastModified || 0);
  if (savedModified && fileModified && savedModified !== fileModified) return false;
  return true;
}

export function sessionProgress(session) {
  const files = session?.files || [];
  const total = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
  const done = files.reduce((sum, file) => sum + (Number(file.uploadedBytes) || 0), 0);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

export function sessionIsResumable(session, now = Date.now()) {
  if (!session?.deleteToken || !session?.shareId || !Array.isArray(session.files) || session.files.length === 0) {
    return false;
  }
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= now) return false;
  const savedAt = new Date(session.savedAt || 0).getTime();
  if (!Number.isFinite(savedAt) || now - savedAt > RESUME_MAX_AGE_MS) return false;
  return session.files.some((file) => file.uploadId || file.s3Key);
}

export function matchResumeSession(sessions, files, now = Date.now()) {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) return null;
  const candidates = (sessions || [])
    .filter((session) => sessionIsResumable(session, now))
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  for (const session of candidates) {
    const matches = list.filter((file) => session.files.some((saved) => identitiesMatch(saved, file)));
    if (matches.length === list.length) return session;
  }
  return null;
}

export function describeResume(session) {
  const files = session?.files || [];
  const name = files.length === 1 ? files[0].name : `${files.length} files`;
  return { name, percent: sessionProgress(session), shareId: session?.shareId || '' };
}

export function snapshotFromManager(manager) {
  if (!manager?.deleteToken || !manager?.shareId) return null;
  const files = (manager.files || []).filter((file) => file.uploadId || file.s3Key).map((file) => {
    const completed = Array.isArray(file.completedParts) ? file.completedParts : [];
    const numbers = completed.map((part) => part.partNumber);
    return {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified || 0,
      type: file.type || 'application/octet-stream',
      uploadId: file.uploadId || null,
      s3Key: file.s3Key || null,
      singlePut: Boolean(file.singlePut),
      completedParts: completed,
      uploadedBytes: bytesFromCompletedParts(file.size, numbers, file.partSize),
    };
  });
  if (files.length === 0) return null;
  return {
    shareId: manager.shareId,
    deleteToken: manager.deleteToken,
    claimToken: manager.claimToken || null,
    expiresAt: manager.expiresAt || null,
    savedAt: new Date().toISOString(),
    partSize: manager.partSize || null,
    files,
  };
}

function memoryStore() {
  if (!globalThis.__staUploadMemory) globalThis.__staUploadMemory = new Map();
  return globalThis.__staUploadMemory;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    memoryStore().clear();
    for (const session of sessions) memoryStore().set(session.shareId, session);
  }
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'shareId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function idbAll(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

export async function loadUploadSessions() {
  const db = await openDb();
  if (db) {
    try {
      return await idbAll(db);
    } catch {
      // Fall through to localStorage.
    } finally {
      db.close();
    }
  }
  const local = readLocal();
  if (local.length > 0) return local;
  return [...memoryStore().values()];
}

export async function saveUploadSession(session) {
  if (!session?.shareId) return;
  const db = await openDb();
  if (db) {
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(session);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch {
      // Fall through.
    } finally {
      db.close();
    }
  }
  const sessions = readLocal().filter((item) => item.shareId !== session.shareId);
  sessions.push(session);
  writeLocal(sessions);
  memoryStore().set(session.shareId, session);
}

export async function deleteUploadSession(shareId) {
  if (!shareId) return;
  memoryStore().delete(shareId);
  const db = await openDb();
  if (db) {
    try {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(shareId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Still clear the local copy.
    } finally {
      db.close();
    }
  }
  writeLocal(readLocal().filter((item) => item.shareId !== shareId));
}

export function applyResumeToFile(item, saved, partSize) {
  if (!item || !saved) return item;
  item.uploadId = saved.uploadId || null;
  item.s3Key = saved.s3Key || null;
  item.singlePut = Boolean(saved.singlePut);
  item.lastModified = saved.lastModified || item.lastModified || 0;
  item.completedParts = Array.isArray(saved.completedParts) ? saved.completedParts.map((part) => ({
    partNumber: Number(part.partNumber),
    etag: part.etag || '',
  })) : [];
  item.completedPartNumbers = item.completedParts.map((part) => part.partNumber);
  const count = partCountFor(item.size, partSize);
  item.partBytes = Array.from({ length: count }, (_, index) => (
    item.completedPartNumbers.includes(index + 1) ? partByteLength(index + 1, item.size, partSize) : 0
  ));
  item.uploadedBytes = item.partBytes.reduce((sum, value) => sum + value, 0);
  item.progress = item.size > 0 ? Math.min(99, Math.round((item.uploadedBytes / item.size) * 100)) : 0;
  return item;
}
