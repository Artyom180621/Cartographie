/* ============================================
   Map - MapLibre GL init & multi-basemap system
   Chaque basemap est un layer raster indépendant.
   On peut en superposer plusieurs, changer leur
   opacité, et réordonner via moveLayer.
   ============================================ */
const MapEngine = (() => {
  let map = null;

  function init() {
    map = new maplibregl.Map({
      container: 'map',
      style: BASE_STYLE,
      center: [2.3522, 48.8566],
      zoom: 5,
      attributionControl: false,
      hash: true
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 150, unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('mousemove', (e) => {
      const { lng, lat } = e.lngLat;
      const z = Math.round(map.getZoom() * 10) / 10;
      const el = document.getElementById('coord-display');
      if (el) el.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} | Z: ${z}`;
    });

    map.on('zoomend', () => {
      const el = document.getElementById('status-zoom');
      if (el) el.textContent = `Zoom: ${Math.round(map.getZoom() * 10) / 10}`;
    });

    map.on('load', () => {
      Layers.addAll(map);
      document.dispatchEvent(new Event('map-ready'));
    });

    return map;
  }

  /* ---- Multi-basemap controls ---- */

  /** Toggle a basemap layer on/off */
  function toggleBasemap(key) {
    if (!map || !MapStyles[key]) return;
    const layerId = `basemap-${key}-layer`;
    if (!map.getLayer(layerId)) return;

    const isVisible = !BasemapState.visible[key];
    BasemapState.setVisible(key, isVisible);

    try {
      map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
    } catch (e) {
      console.warn(`[Map] toggleBasemap ${key}:`, e);
    }

    updateStatusBar();
  }

  /** Set opacity for a basemap (0-100) */
  function setBasemapOpacity(key, opacity) {
    if (!map) return;
    const layerId = `basemap-${key}-layer`;
    BasemapState.setOpacity(key, opacity);
    try {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'raster-opacity', opacity / 100);
      }
    } catch (e) {
      console.warn(`[Map] setOpacity ${key}:`, e);
    }
  }

  /** Reorder basemap layers according to new order array */
  function reorderBasemaps(orderedKeys) {
    if (!map) return;
    BasemapState.order = orderedKeys;

    const firstOverlay = Layers.getFirstLayerId();

    for (let i = 0; i < orderedKeys.length; i++) {
      const layerId = `basemap-${orderedKeys[i]}-layer`;
      try {
        if (map.getLayer(layerId)) {
          map.moveLayer(layerId, firstOverlay || undefined);
        }
      } catch (e) {
        console.warn(`[Map] reorder ${layerId}:`, e);
      }
    }
  }

  /** Update OpenAIP layers (both aero + drone) with a new API key */
  function setOpenAIPKey(apiKey) {
    if (!map) return;
    localStorage.setItem(OPENAIP_STORAGE_KEY, apiKey);

    // Update both OpenAIP layers
    const openAIPLayers = ['highalt', 'lowalt'];
    for (const key of openAIPLayers) {
      const def = MapStyles[key];
      if (!def || !def.isOpenAIP) continue;

      const sourceId = `basemap-${key}`;
      const layerId = `basemap-${key}-layer`;

      // Remove old layer and source
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (e) {}

      if (apiKey) {
        const tileUrl = `https://api.tiles.openaip.net/api/data/${def.endpoint}/{z}/{x}/{y}.png?apiKey=${apiKey}`;
        try {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
            maxzoom: 14
          });
          const opacity = (BasemapState.opacity[key] || 70) / 100;
          const isVisible = BasemapState.visible[key];

          const firstOverlay = Layers.getFirstLayerId();
          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            layout: { visibility: isVisible ? 'visible' : 'none' },
            paint: { 'raster-opacity': opacity }
          }, firstOverlay || undefined);
        } catch (e) {
          console.error(`[Map] Failed to add ${key} layer:`, e);
        }
      }
    }

    showToast('Couches aéronautiques mises à jour', 'success');
  }

  function updateStatusBar() {
    const active = BasemapState.order.filter(k => BasemapState.visible[k]);
    const el = document.getElementById('status-tiles');
    if (el) {
      if (active.length === 0) {
        el.textContent = 'Tuiles: aucune';
      } else {
        el.textContent = `Tuiles: ${active.map(k => MapStyles[k]?.name || k).join(' + ')}`;
      }
    }
  }

  function getMap() { return map; }

  return { init, toggleBasemap, setBasemapOpacity, reorderBasemaps, setOpenAIPKey, getMap, updateStatusBar };
})();
