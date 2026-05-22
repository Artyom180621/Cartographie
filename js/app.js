/* ============================================
   App - Main entry point & interactions
   ============================================ */

let currentTool = 'select';
let measurePoints = [];
let measureMarkers = [];

// --- Boot ---
document.addEventListener('DOMContentLoaded', boot);

function boot() {
  const map = MapEngine.init();
  document.addEventListener('map-ready', () => {
    try { Geocoder.init(); } catch (e) { console.error('Geocoder init failed:', e); }
    try { Routes.init(); } catch (e) { console.error('Routes init failed:', e); }
    try { Drawing.init(); } catch (e) { console.error('Drawing init failed:', e); }
    try { Importer.init(); } catch (e) { console.error('Importer init failed:', e); }
    try { Activity.init(); } catch (e) { console.error('Activity init failed:', e); }
    try { setupMapInteractions(map); } catch (e) { console.error('Map interactions setup failed:', e); }
    try { setupNetworkStatus(); } catch (e) { console.error('Network status setup failed:', e); }
    try { initLayerPanel(); } catch (e) { console.error('Layer panel init failed:', e); }
    try { MapEngine.updateStatusBar(); } catch (e) {}
    console.log('%c🗺 Cartographe Loaded', 'color:#6382ff;font-size:16px;font-weight:bold');
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
  Layers.setSourceData(map, 'measure-line', { type: 'Feature', geometry: { type: 'LineString', coordinates: measurePoints } });
  Layers.setSourceData(map, 'measure-points', { type: 'FeatureCollection', features: measurePoints.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c } })) });
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
    Layers.setSourceData(map, 'measure-line', { type: 'FeatureCollection', features: [] });
    Layers.setSourceData(map, 'measure-points', { type: 'FeatureCollection', features: [] });
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

/* ============================================
   Layer Panel — Multi-basemap management
   ============================================ */

function initLayerPanel() {
  renderBasemapList();
  initDragAndDrop();
  // Pre-fill OpenAIP API key
  const savedKey = getOpenAIPKey();
  const keyInput = document.getElementById('openaip-api-key');
  if (keyInput && savedKey) {
    keyInput.value = savedKey;
  }
}

function renderBasemapList() {
  const container = document.getElementById('basemap-list');
  if (!container) return;
  container.innerHTML = '';

  for (const key of BasemapState.order) {
    const def = MapStyles[key];
    if (!def) continue;

    const isVisible = BasemapState.visible[key];
    const opacity = BasemapState.opacity[key];

    const item = document.createElement('div');
    item.className = `basemap-item${isVisible ? ' active' : ''}`;
    item.dataset.key = key;
    item.draggable = true;

    item.innerHTML = `
      <div class="basemap-item-drag" title="Glisser pour réordonner">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>
      </div>
      <button class="basemap-item-eye${isVisible ? ' on' : ''}" onclick="toggleBasemapUI('${key}')" title="Afficher/masquer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${isVisible
            ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
            : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
          }
        </svg>
      </button>
      <div class="basemap-item-info">
        <span class="basemap-item-icon">${def.icon}</span>
        <span class="basemap-item-name">${def.name}</span>
      </div>
      <div class="basemap-item-opacity">
        <input type="range" class="opacity-slider" min="0" max="100" value="${opacity}"
               oninput="setBasemapOpacityUI('${key}', this.value)"
               title="Opacité: ${opacity}%"
               ${!isVisible ? 'disabled' : ''}>
        <span class="opacity-value">${opacity}%</span>
      </div>
    `;

    container.appendChild(item);
  }
}

function toggleBasemapUI(key) {
  // For OpenAIP layers, check API key first
  const def = MapStyles[key];
  if (def?.isOpenAIP && !BasemapState.visible[key]) {
    const apiKey = getOpenAIPKey();
    if (!apiKey) {
      showToast('Entrez votre clé API OpenAIP pour activer les couches aéronautiques', 'info');
      const input = document.getElementById('openaip-api-key');
      if (input) input.focus();
      return;
    }
  }

  MapEngine.toggleBasemap(key);
  renderBasemapList();
  initDragAndDrop();
}

function setBasemapOpacityUI(key, value) {
  MapEngine.setBasemapOpacity(key, parseInt(value));
  const item = document.querySelector(`.basemap-item[data-key="${key}"]`);
  if (item) {
    const label = item.querySelector('.opacity-value');
    if (label) label.textContent = `${value}%`;
    const slider = item.querySelector('.opacity-slider');
    if (slider) slider.title = `Opacité: ${value}%`;
  }
}

function saveOpenAIPKey() {
  const input = document.getElementById('openaip-api-key');
  if (!input) return;
  const key = input.value.trim();
  if (!key) {
    showToast('Veuillez entrer une clé API valide', 'error');
    return;
  }
  MapEngine.setOpenAIPKey(key);
  renderBasemapList();
  initDragAndDrop();
}

/* ---- Drag & Drop for reordering ---- */
let draggedItem = null;

function initDragAndDrop() {
  const container = document.getElementById('basemap-list');
  if (!container) return;

  const items = container.querySelectorAll('.basemap-item');
  items.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  draggedItem = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.key);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.basemap-item').forEach(i => i.classList.remove('drag-over'));
  draggedItem = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  if (this !== draggedItem) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  if (!draggedItem || this === draggedItem) return;

  const container = document.getElementById('basemap-list');
  const items = [...container.querySelectorAll('.basemap-item')];
  const fromIndex = items.indexOf(draggedItem);
  const toIndex = items.indexOf(this);

  if (fromIndex < toIndex) {
    this.parentNode.insertBefore(draggedItem, this.nextSibling);
  } else {
    this.parentNode.insertBefore(draggedItem, this);
  }

  const newOrder = [...container.querySelectorAll('.basemap-item')].map(i => i.dataset.key);
  MapEngine.reorderBasemaps(newOrder);
}

// --- Delegate functions for HTML onclick ---
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
