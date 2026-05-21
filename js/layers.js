/* ============================================
   Layers - Data layer definitions & toggle
   All drawing/route/measure elements are pure
   MapLibre layers → they never drift on zoom.
   ============================================ */
const Layers = (() => {
  const EMPTY_FC = { type: 'FeatureCollection', features: [] };
  const EMPTY_LS = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };

  /* Source IDs */
  const SOURCE_IDS = [
    'route-line', 'route-line-border', 'route-points', 'saved-routes',
    'drawings', 'imports', 'draw-temp-line', 'activity-track',
    'measure-line', 'measure-points'
  ];

  /* Our own data cache — survives style switches */
  const dataCache = {};

  /* Visibility state — survives style switches */
  const vis = { 'routes-layer': true, 'drawings-layer': true, 'grid-layer': true };

  /* Layer definitions */
  function defs() {
    return [
      { id: 'saved-routes-layer',      type: 'line',   source: 'saved-routes',      paint: { 'line-color': ['get','color'], 'line-width': 4, 'line-opacity': 0.8 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-line-border-layer', type: 'line',   source: 'route-line-border', paint: { 'line-color': '#3b55cc', 'line-width': 8, 'line-opacity': 0.5 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-line-layer',        type: 'line',   source: 'route-line',        paint: { 'line-color': '#6382ff', 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-points-layer',      type: 'circle', source: 'route-points',      paint: { 'circle-radius': 9, 'circle-color': '#6382ff', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } },
      { id: 'drawings-fill',   type: 'fill',   source: 'drawings', filter: ['==','$type','Polygon'],    paint: { 'fill-color': ['get','color'], 'fill-opacity': 0.25 } },
      { id: 'drawings-line',   type: 'line',   source: 'drawings', filter: ['any',['==','$type','LineString'],['==','$type','Polygon']], paint: { 'line-color': ['get','color'], 'line-width': 4, 'line-opacity': 0.95 } },
      { id: 'drawings-points', type: 'circle', source: 'drawings', filter: ['==','$type','Point'],      paint: { 'circle-radius': 12, 'circle-color': ['get','color'], 'circle-stroke-width': 4, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95 } },
      { id: 'imports-fill',   type: 'fill',   source: 'imports', filter: ['==','$type','Polygon'],    paint: { 'fill-color': ['coalesce', ['get','color'], '#60a5fa'], 'fill-opacity': 0.2 } },
      { id: 'imports-line',   type: 'line',   source: 'imports', filter: ['any',['==','$type','LineString'],['==','$type','Polygon']], paint: { 'line-color': ['coalesce', ['get','color'], '#60a5fa'], 'line-width': 3, 'line-opacity': 0.9 } },
      { id: 'imports-points', type: 'circle', source: 'imports', filter: ['==','$type','Point'],      paint: { 'circle-radius': 8, 'circle-color': ['coalesce', ['get','color'], '#60a5fa'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } },
      { id: 'draw-temp-line-layer', type: 'line', source: 'draw-temp-line', paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [6,4], 'line-opacity': 0.8 } },
      { id: 'activity-track-layer', type: 'line', source: 'activity-track', paint: { 'line-color': '#34d399', 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'measure-line-layer',   type: 'line',   source: 'measure-line',   paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [4,4] } },
      { id: 'measure-points-layer', type: 'circle', source: 'measure-points', paint: { 'circle-radius': 7, 'circle-color': '#fbbf24', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } },
    ];
  }

  const TOGGLE_MAP = {
    'routes-layer':   ['route-line-layer','route-line-border-layer','route-points-layer','saved-routes-layer'],
    'drawings-layer': ['drawings-fill','drawings-line','drawings-points','draw-temp-line-layer','imports-fill','imports-line','imports-points'],
    'grid-layer':     [],
  };

  /** Store data in cache AND push to map source */
  function setSourceData(map, srcId, data) {
    dataCache[srcId] = data;
    try {
      const s = map?.getSource(srcId);
      if (s) s.setData(data);
    } catch(e) { /* source not ready yet, data is cached for later */ }
  }

  /** Create all sources + layers. Safe to call multiple times. */
  function addAll(map) {
    if (!map.isStyleLoaded()) {
      console.warn('[Layers] Style not loaded yet, deferring...');
      return;
    }
    // Sources
    for (const id of SOURCE_IDS) {
      if (!map.getSource(id)) {
        const data = dataCache[id] || (id === 'draw-temp-line' || id === 'activity-track' ? { ...EMPTY_LS } : { ...EMPTY_FC });
        try { map.addSource(id, { type: 'geojson', data }); } catch(e) { console.warn('[Layers] src fail:', id, e.message); }
      }
    }
    // Layers
    for (const def of defs()) {
      if (!map.getLayer(def.id)) {
        try { map.addLayer(def); } catch(e) { console.warn('[Layers] lyr fail:', def.id, e.message); }
      }
    }
    // Push cached data to newly-created sources
    for (const id of SOURCE_IDS) {
      if (dataCache[id]) {
        try { map.getSource(id)?.setData(dataCache[id]); } catch(e) {}
      }
    }
    applyVis(map);
    console.log('[Layers] ✓ All layers ready');
  }

  /** Apply visibility state */
  function applyVis(map) {
    for (const [gid, lids] of Object.entries(TOGGLE_MAP)) {
      const v = vis[gid] ? 'visible' : 'none';
      lids.forEach(lid => { try { if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', v); } catch(e) {} });
      const el = document.getElementById(`toggle-${gid}`);
      if (el) vis[gid] ? el.classList.add('on') : el.classList.remove('on');
    }
  }

  /** Toggle a layer group */
  function toggle(map, gid) {
    if (!map) return;
    vis[gid] = !vis[gid];
    const v = vis[gid] ? 'visible' : 'none';
    const el = document.getElementById(`toggle-${gid}`);
    if (el) vis[gid] ? el.classList.add('on') : el.classList.remove('on');
    (TOGGLE_MAP[gid] || []).forEach(lid => {
      try { if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', v); } catch(e) {}
    });
  }

  return { addAll, toggle, setSourceData };
})();
