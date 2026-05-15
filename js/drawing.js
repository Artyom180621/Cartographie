/* ============================================
   Drawing - Points, lines, circles, polygones
   Uses ONLY MapLibre layers (no HTML markers)
   → elements never drift on zoom/pan
   ============================================ */
const Drawing = (() => {
  let drawings = [];
  let currentMode = null;
  let tempPoints = [];
  const COLORS = ['#a78bfa','#f472b6','#34d399','#fbbf24','#60a5fa','#f87171','#6ee7b7'];
  let colorIdx = 0;

  function nextColor() { return COLORS[colorIdx++ % COLORS.length]; }

  function init() {
    loadDrawings();
    const map = MapEngine.getMap();
    if (map) {
      map.on('mousemove', (e) => {
        if (!currentMode || currentMode === 'point' || !tempPoints.length) return;
        updateTempLine(e.lngLat);
      });
    }
  }

  async function loadDrawings() {
    drawings = await Storage.getAll('drawings');
    renderOnMap();
    renderList();
  }

  function setMode(mode) {
    clearTemp();
    currentMode = mode;
    document.querySelectorAll('#tab-draw .btn-secondary').forEach(b => {
      b.classList.remove('draw-active');
    });
    if (mode) {
      const btn = document.getElementById(`draw-${mode}`);
      if (btn) btn.classList.add('draw-active');
    }
    const map = MapEngine.getMap();
    if (map) map.getCanvas().style.cursor = mode ? 'crosshair' : '';
  }

  function handleClick(lngLat) {
    if (!currentMode) return false;
    const coord = [lngLat.lng, lngLat.lat];

    if (currentMode === 'point') {
      addDrawing({ type: 'point', geometry: { type: 'Point', coordinates: coord }, label: `Point ${drawings.length + 1}` });
      return true;
    }

    tempPoints.push(coord);
    updateTempLineData();

    if (currentMode === 'circle' && tempPoints.length === 2) {
      const [c, e] = [tempPoints[0], tempPoints[1]];
      const r = Geo.haversine(c[1], c[0], e[1], e[0]);
      addDrawing({ type: 'circle', geometry: { type: 'Polygon', coordinates: [Geo.circle(c, r)] }, label: `Cercle (${Geo.fmtDist(r)})`, center: c, radius: r });
      clearTemp();
      return true;
    }

    if (currentMode === 'line' && tempPoints.length >= 2) {
      showToast(`${tempPoints.length} pts — double-clic ou clic droit pour terminer`, 'info');
    }
    if (currentMode === 'polygon' && tempPoints.length >= 3) {
      showToast(`${tempPoints.length} pts — double-clic ou clic droit pour fermer`, 'info');
    }
    return true;
  }

  function handleDblClick() {
    if (!currentMode || tempPoints.length < 2) return false;
    if (currentMode === 'line') {
      addDrawing({ type: 'line', geometry: { type: 'LineString', coordinates: [...tempPoints] }, label: `Ligne (${Geo.fmtDist(Geo.lineLength(tempPoints))})` });
      clearTemp();
      return true;
    }
    if (currentMode === 'polygon' && tempPoints.length >= 3) {
      const closed = [...tempPoints, tempPoints[0]];
      addDrawing({ type: 'polygon', geometry: { type: 'Polygon', coordinates: [closed] }, label: `Polygone (${Geo.fmtArea(Geo.polyArea(tempPoints))})` });
      clearTemp();
      return true;
    }
    return false;
  }

  async function addDrawing(d) {
    const item = { id: 'draw_' + Date.now(), ...d, color: d.color || nextColor(), createdAt: new Date().toISOString() };
    drawings.push(item);
    await Storage.put('drawings', item);
    renderOnMap();
    renderList();
    showToast(`${item.label} ajouté`, 'success');
  }

  async function removeDrawing(id) {
    drawings = drawings.filter(d => d.id !== id);
    await Storage.remove('drawings', id);
    renderOnMap();
    renderList();
  }

  async function clearAll() {
    drawings = [];
    await Storage.clear('drawings');
    renderOnMap();
    renderList();
    showToast('Tous les dessins supprimés', 'info');
  }

  /** Push drawings to the MapLibre 'drawings' source — pure vector, no drift */
  function renderOnMap() {
    const map = MapEngine.getMap();
    if (!map || !map.getSource('drawings')) return;
    const features = drawings.map(d => ({
      type: 'Feature',
      properties: { color: d.color, label: d.label, id: d.id },
      geometry: d.geometry
    }));
    map.getSource('drawings').setData({ type: 'FeatureCollection', features });
  }

  function renderList() {
    const c = document.getElementById('drawings-list');
    if (!drawings.length) { c.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Aucun élément</p>'; return; }
    c.innerHTML = drawings.map(d => `
      <div class="route-item" style="padding:8px 10px;margin-bottom:4px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px"><span style="color:${d.color}">●</span> ${d.label}</span>
          <span class="waypoint-remove" style="opacity:1;font-size:11px" onclick="Drawing.removeDrawing('${d.id}')">✕</span>
        </div>
      </div>`).join('');
  }

  /* --- Temp line (follows cursor during drawing) --- */
  function updateTempLineData() {
    const map = MapEngine.getMap();
    if (!map || !map.getSource('draw-temp-line')) return;
    let coords = [...tempPoints];
    if (currentMode === 'polygon' && tempPoints.length >= 3) coords.push(tempPoints[0]);
    map.getSource('draw-temp-line').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
  }

  function updateTempLine(lngLat) {
    const map = MapEngine.getMap();
    if (!map || !map.getSource('draw-temp-line') || !tempPoints.length) return;
    const mouse = [lngLat.lng, lngLat.lat];
    let coords = [...tempPoints, mouse];
    if (currentMode === 'polygon' && tempPoints.length >= 2) coords.push(tempPoints[0]);
    map.getSource('draw-temp-line').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
  }

  function clearTemp() {
    tempPoints = [];
    const map = MapEngine.getMap();
    if (map && map.getSource('draw-temp-line')) {
      map.getSource('draw-temp-line').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    }
  }

  function getMode() { return currentMode; }
  function getDrawings() { return drawings; }

  return { init, setMode, handleClick, handleDblClick, removeDrawing, clearAll, getMode, getDrawings, renderOnMap };
})();
