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
    const def = MapStyles[styleKey];

    // Juste changer les tuiles du fond — les overlays ne bougent pas
    const src = map.getSource('basemap');
    if (src) {
      // MapLibre ne permet pas de changer les tiles directement sur un source existant.
      // On doit supprimer et recréer la source basemap + son layer.
      if (map.getLayer('basemap-layer')) map.removeLayer('basemap-layer');
      map.removeSource('basemap');

      map.addSource('basemap', {
        type: 'raster',
        tiles: def.tiles,
        tileSize: def.tileSize || 256,
        maxzoom: def.maxzoom || 19
      });

      // Ajouter le layer basemap SOUS tous les overlays
      const firstOverlay = Layers.getFirstLayerId();
      if (firstOverlay && map.getLayer(firstOverlay)) {
        map.addLayer({ id: 'basemap-layer', type: 'raster', source: 'basemap' }, firstOverlay);
      } else {
        map.addLayer({ id: 'basemap-layer', type: 'raster', source: 'basemap' });
      }
    }

    // Update UI
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`style-${styleKey}`)?.classList.add('active');
    const el = document.getElementById('status-tiles');
    if (el) el.textContent = `Tuiles: ${def.label}`;
  }

  function getMap() { return map; }
  function getCurrentStyle() { return currentStyle; }

  return { init, setStyle, getMap, getCurrentStyle };
})();
