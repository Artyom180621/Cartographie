/* ============================================
   Importer - KML, GPX, GeoJSON file import
   ============================================ */
const Importer = (() => {
  let importedFeatures = [];

  function init() {
    // Create hidden file input
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
    let totalFeatures = 0;

    for (const file of files) {
      try {
        const text = await file.text();
        const ext = file.name.split('.').pop().toLowerCase();
        let geojson;

        if (ext === 'geojson' || ext === 'json') {
          geojson = JSON.parse(text);
        } else if (ext === 'kml') {
          geojson = parseKML(text);
        } else if (ext === 'gpx') {
          geojson = parseGPX(text);
        } else {
          showToast(`Format non supporté: .${ext}`, 'error');
          continue;
        }

        const features = extractFeatures(geojson);
        importedFeatures.push(...features);
        totalFeatures += features.length;
        showToast(`${file.name}: ${features.length} élément(s) importé(s)`, 'success');
      } catch (err) {
        console.error('Import error:', err);
        showToast(`Erreur: ${file.name} - ${err.message}`, 'error');
      }
    }

    if (totalFeatures > 0) {
      renderOnMap();
      renderList();
      fitToImports();
    }

    // Reset input
    e.target.value = '';
  }

  function extractFeatures(geojson) {
    if (geojson.type === 'FeatureCollection') return geojson.features || [];
    if (geojson.type === 'Feature') return [geojson];
    // Raw geometry
    return [{ type: 'Feature', properties: {}, geometry: geojson }];
  }

  /* --- KML Parser --- */
  function parseKML(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const features = [];

    // Placemarks
    doc.querySelectorAll('Placemark').forEach(pm => {
      const name = pm.querySelector('name')?.textContent || '';
      const desc = pm.querySelector('description')?.textContent || '';

      // Point
      const point = pm.querySelector('Point coordinates');
      if (point) {
        const [lng, lat, alt] = point.textContent.trim().split(',').map(Number);
        features.push({ type: 'Feature', properties: { name, description: desc, color: '#60a5fa' }, geometry: { type: 'Point', coordinates: [lng, lat] } });
      }

      // LineString
      const line = pm.querySelector('LineString coordinates');
      if (line) {
        const coords = parseKMLCoords(line.textContent);
        features.push({ type: 'Feature', properties: { name, description: desc, color: '#34d399' }, geometry: { type: 'LineString', coordinates: coords } });
      }

      // Polygon
      const poly = pm.querySelector('Polygon outerBoundaryIs LinearRing coordinates');
      if (poly) {
        const coords = parseKMLCoords(poly.textContent);
        features.push({ type: 'Feature', properties: { name, description: desc, color: '#a78bfa' }, geometry: { type: 'Polygon', coordinates: [coords] } });
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

  /* --- GPX Parser --- */
  function parseGPX(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const features = [];

    // Waypoints
    doc.querySelectorAll('wpt').forEach(wpt => {
      const lat = parseFloat(wpt.getAttribute('lat'));
      const lng = parseFloat(wpt.getAttribute('lon'));
      const name = wpt.querySelector('name')?.textContent || 'Waypoint';
      features.push({ type: 'Feature', properties: { name, color: '#fbbf24' }, geometry: { type: 'Point', coordinates: [lng, lat] } });
    });

    // Tracks
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

    // Routes
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

  /* --- Render --- */
  function renderOnMap() {
    const map = MapEngine.getMap();
    if (!map) return;
    const data = { type: 'FeatureCollection', features: importedFeatures };
    Layers.setSourceData(map, 'imports', data);
  }

  function renderList() {
    const c = document.getElementById('imports-list');
    if (!c) return;
    if (!importedFeatures.length) {
      c.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Aucun fichier importé</p>';
      return;
    }
    c.innerHTML = importedFeatures.map((f, i) => {
      const name = f.properties?.name || `Élément ${i + 1}`;
      const color = f.properties?.color || '#60a5fa';
      const type = f.geometry?.type || '?';
      return `
        <div class="route-item" style="padding:8px 10px;margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px"><span style="color:${color}">●</span> ${name} <small style="color:var(--text-muted)">(${type})</small></span>
            <span class="waypoint-remove" style="opacity:1;font-size:11px" onclick="Importer.removeFeature(${i})">✕</span>
          </div>
        </div>`;
    }).join('');
  }

  function removeFeature(index) {
    importedFeatures.splice(index, 1);
    renderOnMap();
    renderList();
  }

  function clearAll() {
    importedFeatures = [];
    renderOnMap();
    renderList();
    showToast('Imports effacés', 'info');
  }

  function fitToImports() {
    const map = MapEngine.getMap();
    if (!map || !importedFeatures.length) return;
    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    importedFeatures.forEach(f => {
      const addCoord = (c) => { if (c && c.length >= 2 && !isNaN(c[0])) { bounds.extend(c); hasCoords = true; } };
      const g = f.geometry;
      if (!g) return;
      if (g.type === 'Point') addCoord(g.coordinates);
      else if (g.type === 'LineString') g.coordinates.forEach(addCoord);
      else if (g.type === 'Polygon') g.coordinates[0]?.forEach(addCoord);
      else if (g.type === 'MultiLineString') g.coordinates.forEach(l => l.forEach(addCoord));
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p[0]?.forEach(addCoord));
    });

    if (hasCoords) map.fitBounds(bounds, { padding: 60, duration: 1000 });
  }

  function getFeatures() { return importedFeatures; }

  return { init, openFileDialog, renderOnMap, clearAll, removeFeature, getFeatures };
})();
