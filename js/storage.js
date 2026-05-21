/* ============================================
   Storage - IndexedDB persistence layer
   ============================================ */
const Storage = (() => {
  const DB_NAME = 'cartographe';
  const DB_VERSION = 1;
  let db = null;
  let useFallback = false;
  const fallbackStore = {
    routes: {},
    drawings: {},
    activities: {}
  };

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      if (useFallback) return reject(new Error('Using in-memory fallback'));

      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('routes')) d.createObjectStore('routes', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('drawings')) d.createObjectStore('drawings', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('activities')) d.createObjectStore('activities', { keyPath: 'id' });
        };
        req.onsuccess = (e) => { db = e.target.result; resolve(db); };
        req.onerror = (e) => {
          console.warn('IndexedDB open error, falling back to in-memory store:', e.target.error);
          useFallback = true;
          reject(e.target.error);
        };
      } catch (err) {
        console.warn('IndexedDB not supported or blocked, falling back to in-memory store:', err);
        useFallback = true;
        reject(err);
      }
    });
  }

  async function getAll(store) {
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(store, 'readonly');
        const s = tx.objectStore(store);
        const req = s.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`Storage.getAll(${store}) failed, using in-memory fallback:`, e);
      return Object.values(fallbackStore[store] || {});
    }
  }

  async function put(store, data) {
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(store, 'readwrite');
        const s = tx.objectStore(store);
        const req = s.put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`Storage.put(${store}) failed, using in-memory fallback:`, e);
      if (!fallbackStore[store]) fallbackStore[store] = {};
      if (data && data.id) {
        fallbackStore[store][data.id] = data;
      }
      return data;
    }
  }

  async function remove(store, id) {
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(store, 'readwrite');
        const s = tx.objectStore(store);
        const req = s.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`Storage.remove(${store}, ${id}) failed, using in-memory fallback:`, e);
      if (fallbackStore[store]) {
        delete fallbackStore[store][id];
      }
    }
  }

  async function clear(store) {
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(store, 'readwrite');
        tx.objectStore(store).clear().onsuccess = () => resolve();
      });
    } catch (e) {
      console.warn(`Storage.clear(${store}) failed, using in-memory fallback:`, e);
      fallbackStore[store] = {};
    }
  }

  return { open, getAll, put, remove, clear };
})();
