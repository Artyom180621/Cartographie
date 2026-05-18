/* ============================================
   Layers - Data layer definitions & toggle
   All drawing/route/measure elements are pure
   MapLibre layers → they never drift on zoom.
   ============================================ */
const Layers = (() => {
  const EMPTY_FC = JSON.stringify({ type: 'FeatureCollection', features: [] });
  const EMPTY_LS = JSON.stringify({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });

  /* Source ID → default data (as JSON strings for safe cloning) */
  const SOURCE_DEFAULTS = {
    'route-line':        EMPTY_FC,
    'route-line-border': EMPTY_FC,
    'route-points':      EMPTY_FC,
    'saved-routes':      EMPTY_FC,
    'drawings':          EMPTY_FC,
    'imports':           EMPTY_FC,
    'draw-temp-line':    EMPTY_LS,
    'activity-track':    EMPTY_LS,
    'measure-line':      EMPTY_FC,
    'measure-points':    EMPTY_FC,
  };

  /* We store our own copy of source data so it survives style switches */
  const sourceDataCache = {};

  /* Track visibility state so it survives style switches */
  const visibilityState = {
    'routes-layer': true,
    'drawings-layer': true,
    'grid-layer': true,
  };

  /* Layer definitions (order matters: first added = bottom) */
  function getLayerDefs() {
    return [
      { id: 'saved-routes-layer',      type: 'line',   source: 'saved-routes',      paint: { 'line-color': ['get','color'], 'line-width': 4, 'line-opacity': 0.8 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-line-border-layer', type: 'line',   source: 'route-line-border', paint: { 'line-color': '#3b55cc', 'line-width': 8, 'line-opacity': 0.5 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-line-layer',        type: 'line',   source: 'route-line',        paint: { 'line-color': '#6382ff', 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap':'round','line-join':'round' } },
      { id: 'route-points-layer',      type: 'circle', source: 'route-points',      paint: { 'circle-radius': 9, 'circle-color': '#6382ff', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } },
      // Drawing layers
      { id: 'drawings-fill',   type: 'fill',   source: 'drawings', filter: ['==','$type','Polygon'],    paint: { 'fill-color': ['get','color'], 'fill-opacity': 0.25 } },
      { id: 'drawings-line',   type: 'line',   source: 'drawings', filter: ['any',['==','$type','LineString'],['==','$type','Polygon']], paint: { 'line-color': ['get','color'], 'line-width': 4, 'line-opacity': 0.95 } },
      { id: 'drawings-points', type: 'circle', source: 'drawings', filter: ['==','$type','Point'],      paint: { 'circle-radius': 12, 'circle-color': ['get','color'], 'circle-stroke-width': 4, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95 } },
      // Import layers
      { id: 'imports-fill',   type: 'fill',   source: 'imports', filter: ['==','$type','Polygon'],    paint: { 'fill-color': ['coalesce', ['get','color'], '#60a5fa'], 'fill-opacity': 0.2 } },
      { id: 'imports-line',   type: 'line',   source: 'imports', filter: ['any',['==','$type','LineString'],['==','$type','Polygon']], paint: { 'line-color': ['coalesce', ['get','color'], '#60a5fa'], 'line-width': 3, 'line-opacity': 0.9 } },
      { id: 'imports-points', type: 'circle', source: 'imports', filter: ['==','$type','Point'],      paint: { 'circle-radius': 8, 'circle-color': ['coalesce', ['get','color'], '#60a5fa'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } },
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
    'drawings-layer': ['drawings-fill','drawings-line','drawings-points','draw-temp-line-layer','imports-fill','imports-line','imports-points'],
    'grid-layer':     [],
  };

  /** Set data on a source AND cache it locally for survival across style switches */
  function setSourceData(map, sourceId, data) {
    sourceDataCache[sourceId] = data;
    if (map && map.getSource(sourceId)) {
      try { map.getSource(sourceId).setData(data); } catch(e) {}
    }
  }

  /** Add all sources + layers to the map */
  function addAll(map) {
    for (const [id, defaultJson] of Object.entries(SOURCE_DEFAULTS)) {
      if (!map.getSource(id)) {
        const data = sourceDataCache[id] || JSON.parse(defaultJson);
        map.addSource(id, { type: 'geojson', data });
      }
    }
    for (const def of getLayerDefs()) {
      if (!map.getLayer(def.id)) {
        try { map.addLayer(def); } catch(e) { console.warn('[Layers] add fail:', def.id, e.message); }
      }
    }
    // Re-apply visibility state
    applyVisibility(map);
    console.log('[Layers] All layers added.');
  }

  /** Restore sources + layers after style switch */
  function restoreAll(map) {
    for (const [id, defaultJson] of Object.entries(SOURCE_DEFAULTS)) {
      if (!map.getSource(id)) {
        const data = sourceDataCache[id] || JSON.parse(defaultJson);
        map.addSource(id, { type: 'geojson', data });
      }
    }
    for (const def of getLayerDefs()) {
      if (!map.getLayer(def.id)) {
        try { map.addLayer(def); } catch(e) { console.warn('[Layers] restore fail:', def.id, e.message); }
      }
    }
    applyVisibility(map);
  }

  /** Apply visibility state to all toggle groups */
  function applyVisibility(map) {
    for (const [groupId, layerIds] of Object.entries(TOGGLE_MAP)) {
      const visible = visibilityState[groupId] ? 'visible' : 'none';
      layerIds.forEach(lid => {
        try { if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', visible); } catch(e) {}
      });
      // Sync toggle UI
      const el = document.getElementById(`toggle-${groupId}`);
      if (el) { visibilityState[groupId] ? el.classList.add('on') : el.classList.remove('on'); }
    }
  }

  /** Toggle layer group visibility */
  function toggle(map, groupId) {
    if (!map) return;
    visibilityState[groupId] = !visibilityState[groupId];
    const visible = visibilityState[groupId] ? 'visible' : 'none';
    const el = document.getElementById(`toggle-${groupId}`);
    if (el) { visibilityState[groupId] ? el.classList.add('on') : el.classList.remove('on'); }
    (TOGGLE_MAP[groupId] || []).forEach(layerId => {
      try { if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visible); } catch(e) {}
    });
  }

  return { addAll, restoreAll, toggle, setSourceData, SOURCE_DEFAULTS };
})();
