/* ============================================
   Offline - Tile caching with zone selection
   ============================================ */
const Offline = (() => {
  const DB_NAME = 'antigravity-tiles';
  const DB_VERSION = 1;
  const STORE = 'tiles';
  let db = null;
  let selectingZone = false;
  let zoneStart = null;
  let zoneRect = null;

  /* All tile URL templates for download */
  const ALL_TILE_URLS = [
    // OSM Dark
    'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    // Satellite IGN
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    // Esri fallback
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    // OpenTopoMap
    'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    // Plan IGN
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  ];

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'url' });
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getCached(url) {
    const d = await openDB();
    return new Promise(r => {
      const tx = d.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(url);
      req.onsuccess = () => r(req.result || null);
      req.onerror = () => r(null);
    });
  }

  async function cacheTile(url, data) {
    const d = await openDB();
    return new Promise(r => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ url, data, ts: Date.now() });
      tx.oncomplete = () => r();
      tx.onerror = () => r();
    });
  }

  async function init() {
    await openDB();
    await updateStats();
    console.log('[Offline] Tile cache ready');
  }

  /* --- Zone selection mode --- */
  function startZoneSelect() {
    const map = MapEngine.getMap();
    if (!map) return;
    selectingZone = true;
    zoneStart = null;
    map.getCanvas().style.cursor = 'crosshair';
    showToast('Cliquez et faites glisser pour sélectionner la zone à télécharger', 'info');
    closeSidebarOnMobile();

    // Remove old rect
    removeZoneRect();

    map.once('mousedown', onZoneStart);
    map.once('touchstart', (e) => {
      if (e.originalEvent.touches.length === 1) {
        onZoneStart({ lngLat: map.unproject([e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY]) });
      }
    });
  }

  function onZoneStart(e) {
    const map = MapEngine.getMap();
    zoneStart = e.lngLat;
    map.on('mousemove', onZoneMove);
    map.on('touchmove', onZoneTouchMove);
    map.once('mouseup', onZoneEnd);
    map.once('touchend', onZoneEnd);
  }

  function onZoneMove(e) { drawZoneRect(zoneStart, e.lngLat); }
  function onZoneTouchMove(e) {
    if (e.originalEvent.touches.length === 1) {
      const map = MapEngine.getMap();
      const lngLat = map.unproject([e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY]);
      drawZoneRect(zoneStart, lngLat);
    }
  }

  function onZoneEnd(e) {
    const map = MapEngine.getMap();
    map.off('mousemove', onZoneMove);
    map.off('touchmove', onZoneTouchMove);
    map.getCanvas().style.cursor = '';
    selectingZone = false;

    const end = e.lngLat || (e.originalEvent?.changedTouches?.[0] ? map.unproject([e.originalEvent.changedTouches[0].clientX, e.originalEvent.changedTouches[0].clientY]) : zoneStart);

    if (!zoneStart || !end) return;

    const bounds = new maplibregl.LngLatBounds(
      [Math.min(zoneStart.lng, end.lng), Math.min(zoneStart.lat, end.lat)],
      [Math.max(zoneStart.lng, end.lng), Math.max(zoneStart.lat, end.lat)]
    );

    const zoom = Math.floor(map.getZoom());
    downloadZone(bounds, zoom);
  }

  function drawZoneRect(start, end) {
    const map = MapEngine.getMap();
    if (!map || !start || !end) return;
    const coords = [
      [start.lng, start.lat], [end.lng, start.lat],
      [end.lng, end.lat], [start.lng, end.lat], [start.lng, start.lat]
    ];
    if (!map.getSource('zone-select')) {
      map.addSource('zone-select', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } } });
      map.addLayer({ id: 'zone-select-fill', type: 'fill', source: 'zone-select', paint: { 'fill-color': '#6382ff', 'fill-opacity': 0.15 } });
      map.addLayer({ id: 'zone-select-line', type: 'line', source: 'zone-select', paint: { 'line-color': '#6382ff', 'line-width': 2, 'line-dasharray': [4, 4] } });
    } else {
      map.getSource('zone-select').setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } });
    }
  }

  function removeZoneRect() {
    const map = MapEngine.getMap();
    if (!map) return;
    if (map.getLayer('zone-select-fill')) map.removeLayer('zone-select-fill');
    if (map.getLayer('zone-select-line')) map.removeLayer('zone-select-line');
    if (map.getSource('zone-select')) map.removeSource('zone-select');
  }

  /* --- Download tiles for a zone across ALL map styles --- */
  async function downloadZone(bounds, currentZoom) {
    const minZ = Math.max(0, currentZoom - 1);
    const maxZ = Math.min(currentZoom + 2, 17);

    let tilesToDownload = [];
    for (let z = minZ; z <= maxZ; z++) {
      const tiles = getTilesInBounds(bounds, z);
      for (const tile of tiles) {
        for (const tmpl of ALL_TILE_URLS) {
          tilesToDownload.push(tmpl.replace('{z}', tile.z).replace('{x}', tile.x).replace('{y}', tile.y));
        }
      }
    }

    if (tilesToDownload.length === 0) { showToast('Zone trop petite', 'error'); return; }
    if (tilesToDownload.length > 5000) {
      showToast(`Trop de tuiles (${tilesToDownload.length}). Zoomez plus ou réduisez la zone.`, 'error');
      removeZoneRect();
      return;
    }

    showToast(`Téléchargement de ${tilesToDownload.length} tuiles (toutes les cartes)...`, 'info');
    updateProgress(0, tilesToDownload.length);

    let done = 0;
    const BATCH = 8;
    for (let i = 0; i < tilesToDownload.length; i += BATCH) {
      const batch = tilesToDownload.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (url) => {
        try {
          const existing = await getCached(url);
          if (existing) { done++; return; }
          const resp = await fetch(url);
          if (!resp.ok) { done++; return; }
          const ab = await resp.arrayBuffer();
          await cacheTile(url, new Uint8Array(ab));
          done++;
        } catch (e) { done++; }
      }));
      updateProgress(done, tilesToDownload.length);
    }

    await updateStats();
    removeZoneRect();
    showToast(`✓ ${done}/${tilesToDownload.length} tuiles mises en cache`, 'success');
    updateProgress(done, tilesToDownload.length);
    setTimeout(() => { const el = document.getElementById('offline-progress'); if (el) el.style.display = 'none'; }, 3000);
  }

  /* Download tiles for current view (simple mode) */
  async function downloadArea() {
    const map = MapEngine.getMap();
    if (!map) return;
    downloadZone(map.getBounds(), Math.floor(map.getZoom()));
  }

  function getTilesInBounds(bounds, zoom) {
    const tiles = [];
    const min = lngLatToTile(bounds.getWest(), bounds.getNorth(), zoom);
    const max = lngLatToTile(bounds.getEast(), bounds.getSouth(), zoom);
    for (let x = min.x; x <= max.x; x++) {
      for (let y = min.y; y <= max.y; y++) tiles.push({ x, y, z: zoom });
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

  function updateProgress(current, total) {
    const el = document.getElementById('offline-progress');
    if (!el) return;
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    el.innerHTML = `<div class="offline-progress-bar"><div class="offline-progress-fill" style="width:${pct}%"></div></div><span class="offline-progress-text">${current}/${total}</span>`;
    el.style.display = 'flex';
  }

  async function updateStats() {
    try {
      const d = await openDB();
      const tx = d.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => {
        const el = document.getElementById('offline-stats');
        if (el) el.textContent = `${req.result} tuiles en cache`;
      };
    } catch(e) {}
  }

  async function clearCache() {
    try {
      const d = await openDB();
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => { updateStats(); showToast('Cache vidé', 'info'); };
    } catch(e) { showToast('Erreur vidage cache', 'error'); }
  }

  return { init, startZoneSelect, downloadArea, clearCache, updateStats };
})();
