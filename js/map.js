/* ============================================
   Map - MapLibre GL init & style switching
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
      document.getElementById('coord-display').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} | Z: ${z}`;
    });

    map.on('zoomend', () => {
      document.getElementById('status-zoom').textContent = `Zoom: ${Math.round(map.getZoom() * 10) / 10}`;
    });

    map.on('load', () => {
      Layers.addAll(map);
      document.dispatchEvent(new Event('map-ready'));
    });

    return map;
  }

  function setStyle(styleKey) {
    if (!map || !MapStyles[styleKey]) return;
    currentStyle = styleKey;
    const saved = Layers.saveData(map);

    map.setStyle(MapStyles[styleKey].url);
    map.once('style.load', () => Layers.restoreAll(map, saved));

    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`style-${styleKey}`)?.classList.add('active');
    document.getElementById('status-tiles').textContent = `Tuiles: ${MapStyles[styleKey].label}`;
  }

  function getMap() { return map; }
  function getCurrentStyle() { return currentStyle; }

  return { init, setStyle, getMap, getCurrentStyle };
})();
