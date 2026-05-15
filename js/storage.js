/* ============================================
   Storage - IndexedDB persistence layer
   ============================================ */
const Storage = (() => {
  const DB_NAME = 'antigravity';
  const DB_VERSION = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('routes')) d.createObjectStore('routes', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('drawings')) d.createObjectStore('drawings', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('activities')) d.createObjectStore('activities', { keyPath: 'id' });
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getAll(store) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, 'readonly');
      const s = tx.objectStore(store);
      const req = s.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(store, data) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, 'readwrite');
      const s = tx.objectStore(store);
      const req = s.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(store, id) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, 'readwrite');
      const s = tx.objectStore(store);
      const req = s.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function clear(store) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, 'readwrite');
      tx.objectStore(store).clear().onsuccess = () => resolve();
    });
  }

  return { open, getAll, put, remove, clear };
})();
