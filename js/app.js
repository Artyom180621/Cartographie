/* ============================================
   App - Main entry point & interactions
   ============================================ */

let currentTool = 'select';
let measurePoints = [];
let measureMarkers = [];

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
  Offline.init().then(boot).catch(boot);
});

function boot() {
  const map = MapEngine.init();
  document.addEventListener('map-ready', () => {
    Geocoder.init();
    Routes.init();
    Drawing.init();
    Importer.init();
    Activity.init();
    Offline.updateStats();
    setupMapInteractions(map);
    setupNetworkStatus();
    console.log('%c✈ Antigravity Loaded', 'color:#6382ff;font-size:16px;font-weight:bold');
  });
}

// --- Map interactions ---
function setupMapInteractions(map) {
  map.on('click', (e) => {
    if (Drawing.getMode()) { Drawing.handleClick(e.lngLat); return; }
    if (currentTool === 'measure') { addMeasurePoint(e.lngLat); return; }
    if (currentTool === 'waypoint' && Routes.isCurrentlyEditing()) { Routes.addWaypoint(e.lngLat); return; }
  });
  map.on('dblclick', (e) => {
    if (Drawing.getMode()) { e.preventDefault(); Drawing.handleDblClick(); return; }
    if (currentTool === 'measure' && measurePoints.length >= 2) { e.preventDefault(); finishMeasure(); }
  });
  map.on('contextmenu', (e) => { e.preventDefault(); if (Drawing.getMode()) Drawing.handleDblClick(); });
}

// --- Tool selection ---
function setTool(tool) {
  currentTool = tool;
  const map = MapEngine.getMap();
  document.querySelectorAll('.toolbar .btn-icon').forEach(b => b.classList.remove('active'));
  if (map) map.getCanvas().style.cursor = '';
  clearMeasure();
  if (tool && document.getElementById(`tool-${tool}`)) document.getElementById(`tool-${tool}`).classList.add('active');
  if ((tool === 'waypoint' || tool === 'measure') && map) map.getCanvas().style.cursor = 'crosshair';
}

// --- Measure ---
function addMeasurePoint(lngLat) {
  const coord = [lngLat.lng, lngLat.lat];
  measurePoints.push(coord);
  const el = document.createElement('div');
  el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#fbbf24;border:3px solid #fff;box-shadow:0 0 10px rgba(251,191,36,0.5);';
  measureMarkers.push(new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(MapEngine.getMap()));
  updateMeasureLine();
  if (measurePoints.length >= 2) {
    showToast(`Distance: ${Geo.fmtDist(calcTotalMeasure())} (double-clic pour terminer)`, 'info');
  }
}

function updateMeasureLine() {
  const map = MapEngine.getMap();
  if (!map) return;
  map.getSource('measure-line')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: measurePoints } });
  map.getSource('measure-points')?.setData({ type: 'FeatureCollection', features: measurePoints.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c } })) });
}

function calcTotalMeasure() {
  let t = 0;
  for (let i = 1; i < measurePoints.length; i++) t += Geo.haversine(measurePoints[i-1][1], measurePoints[i-1][0], measurePoints[i][1], measurePoints[i][0]);
  return t;
}

function finishMeasure() {
  if (measurePoints.length >= 2) showToast(`Distance totale: ${Geo.fmtDist(calcTotalMeasure())}`, 'success');
  clearMeasure(); setTool('select');
}

function clearMeasure() {
  measurePoints = [];
  measureMarkers.forEach(m => m.remove());
  measureMarkers = [];
  const map = MapEngine.getMap();
  if (map) {
    map.getSource('measure-line')?.setData({ type: 'FeatureCollection', features: [] });
    map.getSource('measure-points')?.setData({ type: 'FeatureCollection', features: [] });
  }
}

// --- Geolocation ---
function geolocate() {
  if (!navigator.geolocation) { showToast('Géolocalisation non disponible', 'error'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const map = MapEngine.getMap();
      map.flyTo({ center: [longitude, latitude], zoom: 15, duration: 1500 });
      document.querySelectorAll('.loc-marker').forEach(m => m.remove());
      const el = document.createElement('div');
      el.className = 'loc-marker';
      el.style.cssText = 'width:20px;height:20px;border-radius:50%;background:rgba(99,130,255,0.3);border:3px solid #6382ff;box-shadow:0 0 12px rgba(99,130,255,0.5);';
      new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
      showToast(`Position: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, 'info');
    },
    (err) => showToast('Erreur GPS: ' + err.message, 'error'),
    { enableHighAccuracy: true }
  );
}

// --- Delegate functions for HTML onclick ---
function setMapStyle(s) { MapEngine.setStyle(s); }
function toggleLayer(id) { Layers.toggle(MapEngine.getMap(), id); }
function setDrawMode(m) { Drawing.setMode(m); }
function clearAllDrawings() { Drawing.clearAll(); }
function createNewRoute() { Routes.createNew(); }
function calcRoute() { Routes.calcRoute(); }
function saveCurrentRoute() { Routes.saveCurrentRoute(); }
function cancelRouteEdit() { Routes.cancelEdit(); }
function toggleActivity() { Activity.toggle(); }
function toggleRecording() { Activity.toggleRecording(); }
function exportData() { Export.doExport(); }
