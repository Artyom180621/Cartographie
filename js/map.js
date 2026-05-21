/* ============================================
   Map - MapLibre GL init & style switching
   Uses a PERSISTENT style.load listener so
   layers survive unlimited style switches.
   ============================================ */
const MapEngine = (() => {
  let map = null;
  let currentStyle = 'streets';
  let styleReady = false;

  function init() {
    map = new maplibregl.Map({
      container: 'map',
      style: MapStyles.streets.url,
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
      document.getElementById('coord-display').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} | Z: ${z}`;
    });

    map.on('zoomend', () => {
      document.getElementById('status-zoom').textContent = `Zoom: ${Math.round(map.getZoom() * 10) / 10}`;
    });

    /* PERSISTENT listener — fires on EVERY style load (initial + switches) */
    map.on('style.load', () => {
      styleReady = true;
      // Use setTimeout(0) to let MapLibre finalize the style internally
      setTimeout(() => {
        Layers.addAll(map);
        // Re-push module data
        if (typeof Drawing !== 'undefined' && Drawing.renderOnMap) Drawing.renderOnMap();
        if (typeof Routes !== 'undefined' && Routes.renderSavedRoutesOnMap) Routes.renderSavedRoutesOnMap();
        if (typeof Importer !== 'undefined' && Importer.renderOnMap) Importer.renderOnMap();
      }, 0);
    });

    /* First load: emit map-ready for app.js boot */
    map.once('load', () => {
      document.dispatchEvent(new Event('map-ready'));
    });

    return map;
  }

  function setStyle(styleKey) {
    if (!map || !MapStyles[styleKey]) return;
    currentStyle = styleKey;
    styleReady = false;

    // setStyle destroys all sources/layers — the persistent style.load listener will restore them
    map.setStyle(MapStyles[styleKey].url);

    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`style-${styleKey}`)?.classList.add('active');
    document.getElementById('status-tiles').textContent = `Tuiles: ${MapStyles[styleKey].label}`;
  }

  function getMap() { return map; }
  function getCurrentStyle() { return currentStyle; }
  function isReady() { return styleReady; }

  return { init, setStyle, getMap, getCurrentStyle, isReady };
})();
