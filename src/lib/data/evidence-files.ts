// Read-only access to evidence files saved in this browser's IndexedDB by the
// earlier demo version. New files go to the private Supabase "evidence" bucket
// (see uploadEvidence in actions.ts); this module only exists so legacy files can
// be imported (legacy.ts) and, when the user asks, removed.

const DB_NAME = 'cobalance-evidence';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const getLegacyFile = (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key));
export const clearLegacyFiles = () => tx('readwrite', (s) => s.clear());
