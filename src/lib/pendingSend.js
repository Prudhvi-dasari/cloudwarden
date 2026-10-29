/** Holds the files for an in-progress upgrade so checkout can leave and come back. */

const memory = { files: null, plan: '' };
const DB = 'sta-pending-send';
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'i' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function holdPendingSend(files, plan) {
  memory.files = files;
  memory.plan = plan || '';
  try { sessionStorage.setItem('sta_upgrade_plan', memory.plan); } catch { /* ignore */ }
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return openDb().then((db) => new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    files.forEach((file, i) => {
      tx.objectStore(STORE).put({
        i,
        blob: file,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
      });
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  })).catch(() => {});
}

export async function loadPendingSend() {
  if (memory.files?.length) return { files: memory.files, plan: memory.plan };
  let plan = '';
  try { plan = sessionStorage.getItem('sta_upgrade_plan') || ''; } catch { /* ignore */ }
  if (typeof indexedDB === 'undefined') return { files: [], plan };
  try {
    const db = await openDb();
    const rows = await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
    const files = rows
      .sort((a, b) => a.i - b.i)
      .map((row) => new File([row.blob], row.name, { type: row.type, lastModified: row.lastModified }));
    memory.files = files;
    memory.plan = plan;
    return { files, plan };
  } catch {
    return { files: [], plan };
  }
}

export function clearPendingSend() {
  memory.files = null;
  memory.plan = '';
  try { sessionStorage.removeItem('sta_upgrade_plan'); } catch { /* ignore */ }
}
