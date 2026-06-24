"use client";

export interface StoredResumeSource {
  resumeFileName: string;
  resumeText: string;
  resumeMimeType?: string;
}

function storageKey(userId: string) {
  return `cv-mojo:resume-source:${userId}`;
}

const DB_NAME = "cv-mojo-storage";
const DB_VERSION = 1;
const STORE_NAME = "resume-files";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export function loadLocalStoredResumeSource(userId: string): StoredResumeSource | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredResumeSource;
    if (!parsed.resumeFileName && !parsed.resumeText) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalStoredResumeSource(userId: string, payload: StoredResumeSource) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
}

export function clearLocalStoredResumeSource(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(userId));
}

export async function saveLocalStoredResumeFile(userId: string, file: File) {
  if (typeof window === "undefined") return;
  await withStore("readwrite", (store) => store.put(file, userId));
}

export async function loadLocalStoredResumeFile(userId: string): Promise<File | Blob | null> {
  if (typeof window === "undefined") return null;
  const result = await withStore<File | Blob | undefined>("readonly", (store) => store.get(userId));
  return result ?? null;
}

export async function clearLocalStoredResumeFile(userId: string) {
  if (typeof window === "undefined") return;
  await withStore("readwrite", (store) => store.delete(userId));
}
