/* ============================================
   Offline - Tile caching via IndexedDB
   Uses addProtocol for transparent caching
   ============================================ */
const Offline = (() => {
  const DB_NAME = 'antigravity-tiles';
  const DB_VERSION = 1;
  const STORE_NAME = 'tiles';
  let db = null;
  let cacheEnabled = true;
  let stats = { cached: 0, served: 0, size: 0 };

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          d.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getCachedTile(url) {
    const d = await openDB();
    return new Promise((resolve) => {
      const tx = d.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function cacheTile(url, data, contentType) {
    const d = await openDB();
    return new Promise((resolve) => {
      const tx = d.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ url, data, contentType, timestamp: Date.now() });
      tx.oncomplete = () => { stats.cached++; resolve(); };
      tx.onerror = () => resolve();
    });
  }

  async function init() {
    await openDB();
    await updateStats();

    // Register protocol for offline tile caching
    if (maplibregl && maplibregl.addProtocol) {
      maplibregl.addProtocol('cached', async (params) => {
        const realUrl = params.url.replace('cached://', '');
        // Try cache first
        const cached = await getCachedTile(realUrl);
        if (cached) {
          stats.served++;
          return { data: cached.data };
        }
        // Fetch from network
        try {
          const resp = await fetch(realUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const arrayBuffer = await resp.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);
          // Cache it
          if (cacheEnabled) {
            cacheTile(realUrl, data, resp.headers.get('content-type') || 'image/png');
          }
          return { data: arrayBuffer };
        } catch (e) {
          // If offline and not cached, return empty
          console.warn('[Offline] Tile not available:', realUrl);
          throw e;
        }
      });
    }

    console.log('[Offline] Tile caching initialized');
  }

  /* Download tiles for the current map view */
  async function downloadArea() {
    const map = MapEngine.getMap();
    if (!map) return;

    const bounds = map.getBounds();
    const currentZoom = Math.floor(map.getZoom());
    const minZoom = Math.max(0, currentZoom - 1);
    const maxZoom = Math.min(currentZoom + 2, 18);

    const style = map.getStyle();
    if (!style || !style.sources) {
      showToast('Impossible de déterminer les sources de tuiles', 'error');
      return;
    }

    // Collect all raster tile URLs
    const tileUrls = [];
    for (const [srcName, src] of Object.entries(style.sources)) {
      if (src.type === 'raster' && src.tiles) {
        tileUrls.push(...src.tiles);
      }
    }

    if (!tileUrls.length) {
      showToast('Pas de tuiles raster à mettre en cache pour ce style', 'error');
      return;
    }

    let totalTiles = 0;
    let downloadedTiles = 0;
    const tilesToDownload = [];

    for (let z = minZoom; z <= maxZoom; z++) {
      const tiles = getTilesInBounds(bounds, z);
      for (const tile of tiles) {
        for (const urlTemplate of tileUrls) {
          const url = urlTemplate
            .replace('{z}', tile.z)
            .replace('{x}', tile.x)
            .replace('{y}', tile.y);
          tilesToDownload.push(url);
        }
      }
    }

    totalTiles = tilesToDownload.length;
    if (totalTiles === 0) {
      showToast('Aucune tuile à télécharger', 'info');
      return;
    }

    if (totalTiles > 2000) {
      showToast(`Trop de tuiles (${totalTiles}). Zoomez plus pour réduire la zone.`, 'error');
      return;
    }

    showToast(`Téléchargement de ${totalTiles} tuiles...`, 'info');
    updateDownloadProgress(0, totalTiles);

    // Download in batches of 6
    const BATCH = 6;
    for (let i = 0; i < tilesToDownload.length; i += BATCH) {
      const batch = tilesToDownload.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (url) => {
        try {
          // Check if already cached
          const existing = await getCachedTile(url);
          if (existing) { downloadedTiles++; return; }
          const resp = await fetch(url);
          if (!resp.ok) return;
          const ab = await resp.arrayBuffer();
          await cacheTile(url, new Uint8Array(ab), resp.headers.get('content-type') || 'image/png');
          downloadedTiles++;
        } catch (e) { /* skip failed tiles */ }
      }));
      updateDownloadProgress(downloadedTiles, totalTiles);
    }

    await updateStats();
    showToast(`✓ ${downloadedTiles}/${totalTiles} tuiles mises en cache`, 'success');
    updateDownloadProgress(totalTiles, totalTiles);
  }

  function getTilesInBounds(bounds, zoom) {
    const tiles = [];
    const minTile = lngLatToTile(bounds.getWest(), bounds.getNorth(), zoom);
    const maxTile = lngLatToTile(bounds.getEast(), bounds.getSouth(), zoom);
    for (let x = minTile.x; x <= maxTile.x; x++) {
      for (let y = minTile.y; y <= maxTile.y; y++) {
        tiles.push({ x, y, z: zoom });
      }
    }
    return tiles;
  }

  function lngLatToTile(lng, lat, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
  }

  function updateDownloadProgress(current, total) {
    const el = document.getElementById('offline-progress');
    if (!el) return;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    el.innerHTML = `<div class="offline-progress-bar"><div class="offline-progress-fill" style="width:${pct}%"></div></div><span class="offline-progress-text">${current}/${total}</span>`;
    el.style.display = current < total ? 'flex' : 'none';
  }

  async function updateStats() {
    try {
      const d = await openDB();
      const tx = d.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => {
        stats.cached = countReq.result;
        const el = document.getElementById('offline-stats');
        if (el) el.textContent = `${stats.cached} tuiles en cache`;
      };
    } catch(e) {}
  }

  async function clearCache() {
    try {
      const d = await openDB();
      const tx = d.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => {
        stats = { cached: 0, served: 0, size: 0 };
        updateStats();
        showToast('Cache de tuiles vidé', 'info');
      };
    } catch(e) {
      showToast('Erreur lors du vidage du cache', 'error');
    }
  }

  function toggleCache(enabled) {
    cacheEnabled = enabled;
    showToast(enabled ? 'Cache activé' : 'Cache désactivé', 'info');
  }

  return { init, downloadArea, clearCache, toggleCache, updateStats };
})();
