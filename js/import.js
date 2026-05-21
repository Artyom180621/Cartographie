/* ============================================
   Importer - KML, GPX, GeoJSON file import
   With clickable list, zoom & highlight
   ============================================ */
const Importer = (() => {
  let importedFeatures = [];
  let highlightedIndex = -1;

  function init() {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'file-import-input';
    input.accept = '.kml,.gpx,.geojson,.json';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', handleFiles);
    document.body.appendChild(input);
  }

  function openFileDialog() {
    document.getElementById('file-import-input')?.click();
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    let total = 0;

    for (const file of files) {
      try {
        const text = await file.text();
        const ext = file.name.split('.').pop().toLowerCase();
        let geojson;

        if (ext === 'geojson' || ext === 'json') geojson = JSON.parse(text);
        else if (ext === 'kml') geojson = parseKML(text);
        else if (ext === 'gpx') geojson = parseGPX(text);
        else { showToast(`Format non supporté: .${ext}`, 'error'); continue; }

        const features = extractFeatures(geojson, file.name);
        importedFeatures.push(...features);
        total += features.length;
        showToast(`${file.name}: ${features.length} élément(s)`, 'success');
      } catch (err) {
        console.error('Import error:', err);
        showToast(`Erreur: ${file.name}`, 'error');
      }
    }

    if (total > 0) { renderOnMap(); renderList(); fitToAll(); }
    e.target.value = '';
  }

  function extractFeatures(geojson, fileName) {
    let raw = [];
    if (geojson.type === 'FeatureCollection') raw = geojson.features || [];
    else if (geojson.type === 'Feature') raw = [geojson];
    else raw = [{ type: 'Feature', properties: {}, geometry: geojson }];

    // Tag each with a source file name
    return raw.map(f => {
      if (!f.properties) f.properties = {};
      if (!f.properties.name) f.properties.name = fileName;
      if (!f.properties.color) {
        const t = f.geometry?.type;
        if (t === 'Point') f.properties.color = '#fbbf24';
        else if (t === 'LineString' || t === 'MultiLineString') f.properties.color = '#34d399';
        else f.properties.color = '#a78bfa';
      }
      return f;
    });
  }

  /* ========== KML Parser ========== */
  function parseKML(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const features = [];

    doc.querySelectorAll('Placemark').forEach(pm => {
      const name = pm.querySelector('name')?.textContent || '';
      const desc = pm.querySelector('description')?.textContent || '';
      const props = { name, description: desc };

      const point = pm.querySelector('Point coordinates');
      if (point) {
        const [lng, lat] = point.textContent.trim().split(',').map(Number);
        features.push({ type: 'Feature', properties: { ...props, color: '#fbbf24' }, geometry: { type: 'Point', coordinates: [lng, lat] } });
      }

      const line = pm.querySelector('LineString coordinates');
      if (line) {
        features.push({ type: 'Feature', properties: { ...props, color: '#34d399' }, geometry: { type: 'LineString', coordinates: parseKMLCoords(line.textContent) } });
      }

      const poly = pm.querySelector('Polygon outerBoundaryIs LinearRing coordinates');
      if (poly) {
        features.push({ type: 'Feature', properties: { ...props, color: '#a78bfa' }, geometry: { type: 'Polygon', coordinates: [parseKMLCoords(poly.textContent)] } });
      }
    });

    return { type: 'FeatureCollection', features };
  }

  function parseKMLCoords(text) {
    return text.trim().split(/\s+/).map(c => {
      const [lng, lat] = c.split(',').map(Number);
      return [lng, lat];
    }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
  }

  /* ========== GPX Parser ========== */
  function parseGPX(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const features = [];

    doc.querySelectorAll('wpt').forEach(wpt => {
      const lat = parseFloat(wpt.getAttribute('lat'));
      const lng = parseFloat(wpt.getAttribute('lon'));
      const name = wpt.querySelector('name')?.textContent || 'Waypoint';
      features.push({ type: 'Feature', properties: { name, color: '#fbbf24' }, geometry: { type: 'Point', coordinates: [lng, lat] } });
    });

    doc.querySelectorAll('trk').forEach(trk => {
      const name = trk.querySelector('name')?.textContent || 'Track';
      trk.querySelectorAll('trkseg').forEach(seg => {
        const coords = [];
        seg.querySelectorAll('trkpt').forEach(pt => {
          coords.push([parseFloat(pt.getAttribute('lon')), parseFloat(pt.getAttribute('lat'))]);
        });
        if (coords.length >= 2) {
          features.push({ type: 'Feature', properties: { name, color: '#34d399' }, geometry: { type: 'LineString', coordinates: coords } });
        }
      });
    });

    doc.querySelectorAll('rte').forEach(rte => {
      const name = rte.querySelector('name')?.textContent || 'Route';
      const coords = [];
      rte.querySelectorAll('rtept').forEach(pt => {
        coords.push([parseFloat(pt.getAttribute('lon')), parseFloat(pt.getAttribute('lat'))]);
      });
      if (coords.length >= 2) {
        features.push({ type: 'Feature', properties: { name, color: '#f472b6' }, geometry: { type: 'LineString', coordinates: coords } });
      }
    });

    return { type: 'FeatureCollection', features };
  }

  /* ========== Render on Map ========== */
  function renderOnMap() {
    const map = MapEngine.getMap();
    if (!map) return;
    Layers.setSourceData(map, 'imports', { type: 'FeatureCollection', features: importedFeatures });
  }

  /* ========== Render clickable list ========== */
  function renderList() {
    const c = document.getElementById('imports-list');
    if (!c) return;
    if (!importedFeatures.length) {
      c.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Aucun fichier importé</p>';
      return;
    }

    const typeIcons = { Point: '📍', LineString: '〰️', Polygon: '🔷', MultiLineString: '〰️', MultiPolygon: '🔷' };

    c.innerHTML = importedFeatures.map((f, i) => {
      const name = f.properties?.name || `Élément ${i + 1}`;
      const color = f.properties?.color || '#60a5fa';
      const gtype = f.geometry?.type || '?';
      const icon = typeIcons[gtype] || '📌';
      const isActive = i === highlightedIndex;
      const activeStyle = isActive ? 'border-color:var(--accent);background:rgba(99,130,255,0.15);' : '';

      return `
        <div class="route-item import-item" style="padding:8px 10px;margin-bottom:4px;cursor:pointer;${activeStyle}"
             onclick="Importer.focusFeature(${i})" id="import-item-${i}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px">
              <span style="color:${color}">${icon}</span> ${name}
              <small style="color:var(--text-muted);margin-left:4px">${gtype}</small>
            </span>
            <span class="waypoint-remove" style="opacity:1;font-size:11px" onclick="event.stopPropagation();Importer.removeFeature(${i})">✕</span>
          </div>
        </div>`;
    }).join('');
  }

  /* ========== Focus & Highlight a feature ========== */
  function focusFeature(index) {
    const f = importedFeatures[index];
    if (!f) return;

    const map = MapEngine.getMap();
    if (!map) return;

    // Update highlight
    highlightedIndex = (highlightedIndex === index) ? -1 : index;
    renderList();

    if (highlightedIndex === -1) return;

    // Compute bounds of this feature
    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;
    const addC = (c) => { if (c && c.length >= 2 && !isNaN(c[0])) { bounds.extend(c); hasCoords = true; } };
    const g = f.geometry;
    if (g.type === 'Point') addC(g.coordinates);
    else if (g.type === 'LineString') g.coordinates.forEach(addC);
    else if (g.type === 'Polygon') g.coordinates[0]?.forEach(addC);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(l => l.forEach(addC));
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p[0]?.forEach(addC));

    if (!hasCoords) return;

    // Fly to the feature
    if (g.type === 'Point') {
      map.flyTo({ center: g.coordinates, zoom: 15, duration: 1200 });
    } else {
      map.fitBounds(bounds, { padding: 80, duration: 1200 });
    }

    // Pulse highlight effect
    pulseFeature(index);
    closeSidebarOnMobile();
  }

  /* Pulse/highlight effect — temporarily changes the color */
  function pulseFeature(index) {
    const original = importedFeatures[index].properties.color;
    importedFeatures[index].properties.color = '#ffffff';
    renderOnMap();

    setTimeout(() => {
      importedFeatures[index].properties.color = '#ff4444';
      renderOnMap();
    }, 300);
    setTimeout(() => {
      importedFeatures[index].properties.color = '#ffffff';
      renderOnMap();
    }, 600);
    setTimeout(() => {
      importedFeatures[index].properties.color = original;
      renderOnMap();
    }, 900);
  }

  function removeFeature(index) {
    importedFeatures.splice(index, 1);
    if (highlightedIndex === index) highlightedIndex = -1;
    else if (highlightedIndex > index) highlightedIndex--;
    renderOnMap();
    renderList();
  }

  function clearAll() {
    importedFeatures = [];
    highlightedIndex = -1;
    renderOnMap();
    renderList();
    showToast('Imports effacés', 'info');
  }

  function fitToAll() {
    const map = MapEngine.getMap();
    if (!map || !importedFeatures.length) return;
    const bounds = new maplibregl.LngLatBounds();
    let has = false;
    const addC = (c) => { if (c && c.length >= 2 && !isNaN(c[0])) { bounds.extend(c); has = true; } };
    importedFeatures.forEach(f => {
      const g = f.geometry;
      if (!g) return;
      if (g.type === 'Point') addC(g.coordinates);
      else if (g.type === 'LineString') g.coordinates.forEach(addC);
      else if (g.type === 'Polygon') g.coordinates[0]?.forEach(addC);
      else if (g.type === 'MultiLineString') g.coordinates.forEach(l => l.forEach(addC));
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p[0]?.forEach(addC));
    });
    if (has) map.fitBounds(bounds, { padding: 60, duration: 1000 });
  }

  function getFeatures() { return importedFeatures; }

  return { init, openFileDialog, renderOnMap, clearAll, removeFeature, focusFeature, getFeatures };
})();
