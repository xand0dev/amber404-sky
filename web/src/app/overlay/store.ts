// Збереження підкладки лише в браузері (SPEC §7.14, Конституція 8): IndexedDB, без мережі.
import type { Anchor } from '../../core';

export interface SavedOverlay { image: Blob; anchors: Anchor[]; opacity: number }

const DB = 'amber-overlay', STORE = 'overlay', KEY = 'current';

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((res) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => res(null);
  });
}

function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then((db) => db && new Promise<T | null>((res) => {
    const rq = op(db.transaction(STORE, mode).objectStore(STORE));
    rq.onsuccess = () => { res(rq.result); db.close(); };
    rq.onerror = () => { res(null); db.close(); };
  }));
}

/** true — збережено; false — IndexedDB недоступна (приватне вікно тощо). */
export async function saveOverlay(v: SavedOverlay): Promise<boolean> {
  return (await run('readwrite', (s) => s.put(v, KEY))) !== null;
}

export async function loadOverlay(): Promise<SavedOverlay | null> {
  const v = await run<SavedOverlay | undefined>('readonly', (s) => s.get(KEY));
  return v && v.image instanceof Blob && Array.isArray(v.anchors) ? v : null;
}

export async function clearOverlay(): Promise<void> {
  await run('readwrite', (s) => s.delete(KEY));
}
