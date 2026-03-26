const DB_NAME = 'vision-tracker';
const DB_VERSION = 2;
const STORE_NAME = 'snapshots';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Delete old recordings store if it exists
      if (db.objectStoreNames.contains('recordings')) {
        db.deleteObjectStore('recordings');
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export interface SnapshotRecord {
  id: string;
  filename: string;
  timestamp: string;
  detections: { label: string; score: number }[];
  objectCount: number;
  imageBlob: Blob;
}

export async function putSnapshot(record: SnapshotRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSnapshot(id: string): Promise<SnapshotRecord | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as SnapshotRecord | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSnapshots(): Promise<SnapshotRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).index('timestamp').openCursor(null, 'prev');
    const results: SnapshotRecord[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        results.push(cursor.value as SnapshotRecord);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
