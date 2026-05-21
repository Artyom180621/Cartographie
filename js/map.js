/* ============================================
   Map - MapLibre GL init & style switching
   La couche dessin est TOUJOURS au-dessus.
   ============================================ */
const MapEngine = (() => {
  let map = null;
  let currentStyle = 'streets';

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
      const el = document.getElementById('coord-display');
      if (el) el.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} | Z: ${z}`;
    });

    map.on('zoomend', () => {
      const el = document.getElementById('status-zoom');
      if (el) el.textContent = `Zoom: ${Math.round(map.getZoom() * 10) / 10}`;
    });

    /* Quand un style se charge (premier load OU switch), on recrée les overlays */
    map.on('style.load', rebuildOverlays);

    /* Premier load : déclencher le boot de l'app */
    map.once('load', () => document.dispatchEvent(new Event('map-ready')));

    return map;
  }

  /** Recréer toutes les couches de dessin au-dessus du fond de carte */
  function rebuildOverlays() {
    // Essayer immédiatement
    Layers.addAll(map);
    pushModuleData();

    // Et aussi avec un délai pour les styles raster qui sont parfois lents
    setTimeout(() => {
      Layers.addAll(map);
      pushModuleData();
    }, 100);

    setTimeout(() => {
      Layers.addAll(map);
      pushModuleData();
    }, 500);
  }

  /** Re-pousser les données des modules vers les sources */
  function pushModuleData() {
    try { if (typeof Drawing !== 'undefined' && Drawing.renderOnMap) Drawing.renderOnMap(); } catch(e) {}
    try { if (typeof Routes !== 'undefined' && Routes.renderSavedRoutesOnMap) Routes.renderSavedRoutesOnMap(); } catch(e) {}
    try { if (typeof Importer !== 'undefined' && Importer.renderOnMap) Importer.renderOnMap(); } catch(e) {}
  }

  function setStyle(styleKey) {
    if (!map || !MapStyles[styleKey]) return;
    currentStyle = styleKey;

    // setStyle détruit tout. Le listener 'style.load' va tout reconstruire.
    map.setStyle(MapStyles[styleKey].url);

    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`style-${styleKey}`)?.classList.add('active');
    const el = document.getElementById('status-tiles');
    if (el) el.textContent = `Tuiles: ${MapStyles[styleKey].label}`;
  }

  function getMap() { return map; }
  function getCurrentStyle() { return currentStyle; }

  return { init, setStyle, getMap, getCurrentStyle };
})();
