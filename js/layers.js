/* ============================================
   Layers — Overlay layers (dessins, routes, etc.)
   + Grille de coordonnées (fixée)
   Toujours AU-DESSUS du fond de carte.
   Survivent à tous les changements de style.
   ============================================ */
const Layers = (() => {

  /* ---- Data cache : survit aux changements de style ---- */
  const cache = {};

  /* ---- Visibility state ---- */
  const vis = { 'routes-layer': true, 'drawings-layer': true, 'grid-layer': false };

  /* ---- Source definitions ---- */
  const SRC = {
    'route-line':        'fc', 'route-line-border': 'fc', 'route-points': 'fc',
    'saved-routes':      'fc', 'drawings':          'fc', 'imports':      'fc',
    'draw-temp-line':    'ls', 'activity-track':    'ls',
    'measure-line':      'fc', 'measure-points':    'fc',
    'grid-lines':        'fc', 'grid-labels':       'fc',
  };

  function emptyFC() { return { type: 'FeatureCollection', features: [] }; }
  function emptyLS() { return { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }; }

  /* ---- Generate coordinate grid GeoJSON ---- */
  function generateGrid() {
    const features = [];

    // Latitude lines (every 10°)
    for (let lat = -80; lat <= 80; lat += 10) {
      const coords = [];
      for (let lng = -180; lng <= 180; lng += 2) {
        coords.push([lng, lat]);
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { label: `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}`, type: 'lat' }
      });
    }

    // Longitude lines (every 10°)
    for (let lng = -180; lng <= 180; lng += 10) {
      const coords = [];
      for (let lat = -85; lat <= 85; lat += 2) {
        coords.push([lng, lat]);
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { label: `${Math.abs(lng)}°${lng >= 0 ? 'E' : 'W'}`, type: 'lon' }
      });
    }

    return { type: 'FeatureCollection', features };
  }

  function generateGridLabels() {
    const features = [];

    // Latitude labels
    for (let lat = -80; lat <= 80; lat += 10) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, lat] },
        properties: { label: `${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}` }
      });
    }

    // Longitude labels
    for (let lng = -180; lng <= 180; lng += 10) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, 0] },
        properties: { label: `${Math.abs(lng)}°${lng >= 0 ? 'E' : 'W'}` }
      });
    }

    return { type: 'FeatureCollection', features };
  }

  /* ---- Layer definitions ---- */
  function allLayers() {
    return [
      // Grid layers
      { id: 'grid-lines-layer', type: 'line', source: 'grid-lines', paint: { 'line-color': 'rgba(255,255,255,0.15)', 'line-width': 1, 'line-dasharray': [4, 4] }, layout: { visibility: vis['grid-layer'] ? 'visible' : 'none' } },
      { id: 'grid-labels-layer', type: 'symbol', source: 'grid-labels', layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': ['Open Sans Regular'], 'text-anchor': 'center', 'text-allow-overlap': false, visibility: vis['grid-layer'] ? 'visible' : 'none' }, paint: { 'text-color': 'rgba(255,255,255,0.4)', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1 } },

      // Route layers
      { id: 'saved-routes-layer',      type: 'line',   source: 'saved-routes',      paint: { 'line-color': ['get','color'], 'line-width': 4, 'line-opacity': 0.8 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-line-border-layer', type: 'line',   source: 'route-line-border', paint: { 'line-color': '#3b55cc', 'line-width': 8, 'line-opacity': 0.5 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-line-layer',        type: 'line',   source: 'route-line',        paint: { 'line-color': '#6382ff', 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-points-layer',      type: 'circle', source: 'route-points',      paint: { 'circle-radius': 9, 'circle-color': '#6382ff', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } },
      { id: 'drawings-fill',   type: 'fill',   source: 'drawings', filter: ['==', ['geometry-type'], 'Polygon'],    paint: { 'fill-color': ['get','color'], 'fill-opacity': 0.25 } },
      { id: 'drawings-line',   type: 'line',   source: 'drawings', filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']], paint: { 'line-color': ['get','color'], 'line-width': 4, 'line-opacity': 0.95 } },
      { id: 'drawings-points', type: 'circle', source: 'drawings', filter: ['==', ['geometry-type'], 'Point'],      paint: { 'circle-radius': 12, 'circle-color': ['get','color'], 'circle-stroke-width': 4, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95 } },
      { id: 'imports-fill',   type: 'fill',   source: 'imports', filter: ['==', ['geometry-type'], 'Polygon'],    paint: { 'fill-color': ['coalesce', ['get','color'], '#60a5fa'], 'fill-opacity': 0.2 } },
      { id: 'imports-line',   type: 'line',   source: 'imports', filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']], paint: { 'line-color': ['coalesce', ['get','color'], '#60a5fa'], 'line-width': 3, 'line-opacity': 0.9 } },
      { id: 'imports-points', type: 'circle', source: 'imports', filter: ['==', ['geometry-type'], 'Point'],      paint: { 'circle-radius': 8, 'circle-color': ['coalesce', ['get','color'], '#60a5fa'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } },
      { id: 'draw-temp-line-layer', type: 'line', source: 'draw-temp-line', paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [6,4], 'line-opacity': 0.8 } },
      { id: 'activity-track-layer', type: 'line', source: 'activity-track', paint: { 'line-color': '#34d399', 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'measure-line-layer',   type: 'line',   source: 'measure-line',   paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [4,4] } },
      { id: 'measure-points-layer', type: 'circle', source: 'measure-points', paint: { 'circle-radius': 7, 'circle-color': '#fbbf24', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } },
    ];
  }

  const GROUPS = {
    'routes-layer':   ['route-line-layer','route-line-border-layer','route-points-layer','saved-routes-layer'],
    'drawings-layer': ['drawings-fill','drawings-line','drawings-points','draw-temp-line-layer','imports-fill','imports-line','imports-points'],
    'grid-layer':     ['grid-lines-layer','grid-labels-layer'],
  };

  /* ==== PUBLIC : store data + push to map ==== */
  function setSourceData(map, id, data) {
    cache[id] = data;
    try { if (map && map.getSource(id)) map.getSource(id).setData(data); } catch(e) {}
  }

  /* ==== PUBLIC : create all overlay sources + layers ==== */
  function addAll(map) {
    // 1. Generate grid data
    cache['grid-lines'] = generateGrid();
    cache['grid-labels'] = generateGridLabels();

    // 2. Add sources
    for (const [id, kind] of Object.entries(SRC)) {
      if (map.getSource(id)) continue;
      const data = cache[id] || (kind === 'ls' ? emptyLS() : emptyFC());
      try { map.addSource(id, { type: 'geojson', data }); } catch(e) { console.warn('[L] src:', id, e.message); }
    }
    // 3. Add layers (always on top)
    for (const def of allLayers()) {
      if (map.getLayer(def.id)) continue;
      try { map.addLayer(def); } catch(e) { console.warn('[L] lyr:', def.id, e.message); }
    }
    // 4. Push cached data into sources
    for (const [id, data] of Object.entries(cache)) {
      try { if (map.getSource(id)) map.getSource(id).setData(data); } catch(e) {}
    }
    // 5. Apply visibility
    for (const [gid, lids] of Object.entries(GROUPS)) {
      const v = vis[gid] ? 'visible' : 'none';
      lids.forEach(lid => { try { if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', v); } catch(e) {} });
      const el = document.getElementById(`toggle-${gid}`);
      if (el) vis[gid] ? el.classList.add('on') : el.classList.remove('on');
    }
    console.log('[Layers] ✓ ready (grid included)');
  }

  /* ==== PUBLIC : toggle visibility ==== */
  function toggle(map, gid) {
    if (!map) return;
    vis[gid] = !vis[gid];
    const v = vis[gid] ? 'visible' : 'none';
    const el = document.getElementById(`toggle-${gid}`);
    if (el) vis[gid] ? el.classList.add('on') : el.classList.remove('on');
    (GROUPS[gid] || []).forEach(lid => {
      try { if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', v); } catch(e) {}
    });
  }

  function getFirstLayerId() {
    const layers = allLayers();
    return layers.length > 0 ? layers[0].id : null;
  }

  return { addAll, toggle, setSourceData, getFirstLayerId };
})();
