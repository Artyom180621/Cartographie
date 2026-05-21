/* ============================================
   Map - MapLibre GL init & basemap switching
   UN SEUL style permanent. On ne change que
   les tuiles du fond de carte. Les overlays
   (dessins, routes) ne sont JAMAIS détruits.
   ============================================ */
const MapEngine = (() => {
  let map = null;
  let currentStyle = 'streets';

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
      // Ajouter les overlays UNE SEULE FOIS — ils ne seront jamais détruits
      Layers.addAll(map);
      document.dispatchEvent(new Event('map-ready'));
    });

    return map;
  }

  /** Changer le fond de carte sans toucher aux overlays */
  function setStyle(styleKey) {
    if (!map || !MapStyles[styleKey]) return;
    currentStyle = styleKey;

    // Toggle visibility of the basemap layers
    for (const key of Object.keys(MapStyles)) {
      const layerId = `basemap-${key}-layer`;
      const isCurrent = key === styleKey;
      try {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', isCurrent ? 'visible' : 'none');
        }
      } catch (e) {
        console.warn(`Failed to set visibility for ${layerId}:`, e);
      }
    }

    // Update UI
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`style-${styleKey}`)?.classList.add('active');
    const el = document.getElementById('status-tiles');
    if (el) el.textContent = `Tuiles: ${MapStyles[styleKey].label}`;
  }

  function getMap() { return map; }
  function getCurrentStyle() { return currentStyle; }

  return { init, setStyle, getMap, getCurrentStyle };
})();
