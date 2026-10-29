/**
 * The in-flight transfer lives here, outside any page, so a route change
 * does not abort it or throw away its progress.
 */

let manager = null;
let snapshot = null;
const listeners = new Set();
let unloadBound = false;

function emit() {
  const state = getActiveUpload();
  for (const listener of listeners) {
    try { listener(state); } catch (error) { console.error(error); }
  }
}

export function getActiveUpload() {
  return { manager, snapshot, result: manager?.result || null };
}

export function subscribeActiveUpload(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function uploadIsActive(snap) {
  if (!snap) return false;
  return snap.overallStatus === 'uploading'
    || snap.overallStatus === 'paused'
    || snap.overallStatus === 'error'
    || (snap.uploadingFiles || 0) > 0
    || (snap.queuedFiles || 0) > 0
    || (snap.pausedFiles || 0) > 0;
}

function bindUnload() {
  if (unloadBound || typeof window === 'undefined') return;
  unloadBound = true;
  window.addEventListener('beforeunload', (event) => {
    if (!uploadIsActive(snapshot)) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

export function publishActiveUpload(next) {
  if (manager && manager !== next) {
    manager.onPersist = null;
  }
  manager = next;
  snapshot = next ? next.getSnapshot() : null;
  if (next) {
    next.on('stateChanged', (snap) => {
      if (manager !== next) return;
      snapshot = snap;
      emit();
    });
    next.onPersist = () => emit();
  }
  bindUnload();
  emit();
}

export function touchActiveUpload() {
  if (manager) snapshot = manager.getSnapshot();
  emit();
}

export function clearActiveUpload(shareId) {
  if (shareId && manager && manager.shareId !== shareId) return;
  manager = null;
  snapshot = null;
  emit();
}

export function activeUploadRunning() {
  return uploadIsActive(snapshot);
}
