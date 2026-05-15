/* ============================================
   Layers - Data layer definitions & toggle
   All drawing/route/measure elements are pure
   MapLibre layers → they never drift on zoom.
   ============================================ */
const Layers = (() => {
  const EMPTY_FC = { type: 'FeatureCollection', features: [] };
  const EMPTY_LS = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };

  /* Source ID → default data */
  const SOURCES = {
    'route-line':        EMPTY_FC,
    'route-line-border': EMPTY_FC,
    'route-points':      EMPTY_FC,
    'saved-routes':      EMPTY_FC,
    'drawings':          EMPTY_FC,
    'draw-temp-line':    EMPTY_LS,
    'activity-track':    EMPTY_LS,
    'measure-line':      EMPTY_FC,
    'measure-points':    EMPTY_FC,
  };

  /* Layer definitions (order matters: first added = bottom) */
  function getLayerDefs() {
    return [
      { id: 'saved-routes-layer',      type: 'line',   source: 'saved-routes',      paint: { 'line-color': ['get','color'], 'line-width': 4, 'line-opacity': 0.8 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-line-border-layer', type: 'line',   source: 'route-line-border', paint: { 'line-color': '#3b55cc', 'line-width': 8, 'line-opacity': 0.5 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-line-layer',        type: 'line',   source: 'route-line',        paint: { 'line-color': '#6382ff', 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-points-layer',      type: 'circle', source: 'route-points',      paint: { 'circle-radius': 9, 'circle-color': '#6382ff', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } },
      // Drawing layers — all pure MapLibre, never drift
      { id: 'drawings-fill',   type: 'fill',   source: 'drawings', filter: ['==','$type','Polygon'],    paint: { 'fill-color': ['get','color'], 'fill-opacity': 0.25 } },
      { id: 'drawings-line',   type: 'line',   source: 'drawings', filter: ['any',['==','$type','LineString'],['==','$type','Polygon']], paint: { 'line-color': ['get','color'], 'line-width': 4, 'line-opacity': 0.95 } },
      { id: 'drawings-points', type: 'circle', source: 'drawings', filter: ['==','$type','Point'],      paint: { 'circle-radius': 12, 'circle-color': ['get','color'], 'circle-stroke-width': 4, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95 } },
      // Temp drawing line
      { id: 'draw-temp-line-layer', type: 'line', source: 'draw-temp-line', paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [6,4], 'line-opacity': 0.8 } },
      // Activity
      { id: 'activity-track-layer', type: 'line', source: 'activity-track', paint: { 'line-color': '#34d399', 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap':'round','line-join':'round' } },
      // Measure
      { id: 'measure-line-layer',   type: 'line',   source: 'measure-line',   paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [4,4] } },
      { id: 'measure-points-layer', type: 'circle', source: 'measure-points', paint: { 'circle-radius': 7, 'circle-color': '#fbbf24', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } },
    ];
  }

  /* Which toggle controls which layers */
  const TOGGLE_MAP = {
    'routes-layer':   ['route-line-layer','route-line-border-layer','route-points-layer','saved-routes-layer'],
    'drawings-layer': ['drawings-fill','drawings-line','drawings-points','draw-temp-line-layer'],
    'grid-layer':     [],
  };

  /** Add all sources + layers to the map */
  function addAll(map) {
    for (const [id, data] of Object.entries(SOURCES)) {
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'geojson', data });
      }
    }
    for (const def of getLayerDefs()) {
      if (!map.getLayer(def.id)) {
        try { map.addLayer(def); } catch(e) { console.warn('[Layers] Failed to add:', def.id, e.message); }
      }
    }
    console.log('[Layers] All layers added. Count:', getLayerDefs().length);
  }

  /** Save current source data before style switch */
  function saveData(map) {
    const saved = {};
    for (const id of Object.keys(SOURCES)) {
      try { const s = map.getSource(id); if (s) saved[id] = s._data || s.serialize()?.data; } catch(e) {}
    }
    return saved;
  }

  /** Restore sources + layers after style switch */
  function restoreAll(map, saved) {
    for (const [id, defaultData] of Object.entries(SOURCES)) {
      if (!map.getSource(id)) {
        map.addSource(id, { type: 'geojson', data: saved[id] || defaultData });
      }
    }
    for (const def of getLayerDefs()) {
      if (!map.getLayer(def.id)) {
        try { map.addLayer(def); } catch(e) { console.warn('[Layers] Restore fail:', def.id, e.message); }
      }
    }
  }

  /** Toggle layer group visibility */
  function toggle(map, groupId) {
    const el = document.getElementById(`toggle-${groupId}`);
    if (!el || !map) return;
    el.classList.toggle('on');
    const visible = el.classList.contains('on') ? 'visible' : 'none';
    (TOGGLE_MAP[groupId] || []).forEach(layerId => {
      try {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visible);
        }
      } catch(e) { console.warn('[Layers] Toggle fail:', layerId, e.message); }
    });
  }

  return { addAll, saveData, restoreAll, toggle, SOURCES };
})();
