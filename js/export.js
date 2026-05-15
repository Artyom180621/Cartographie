/* ============================================
   Export - GPX, KML, GeoJSON generation
   ============================================ */
const Export = (() => {

  function doExport() {
    const format = document.getElementById('export-format').value;
    const content = document.getElementById('export-content').value;
    const data = gatherData(content);

    if (!data.routes.length && !data.drawings.length && !data.track.length) {
      showToast('Rien à exporter', 'error');
      return;
    }

    let output, filename, mime;

    switch (format) {
      case 'gpx':
        output = toGPX(data);
        filename = 'antigravity_export.gpx';
        mime = 'application/gpx+xml';
        break;
      case 'kml':
        output = toKML(data);
        filename = 'antigravity_export.kml';
        mime = 'application/vnd.google-earth.kml+xml';
        break;
      case 'geojson':
        output = toGeoJSON(data);
        filename = 'antigravity_export.geojson';
        mime = 'application/geo+json';
        break;
    }

    download(output, filename, mime);
    closeExportModal();
    showToast(`Export ${format.toUpperCase()} téléchargé`, 'success');
  }

  function gatherData(content) {
    const result = { routes: [], drawings: [], track: [] };
    if (content === 'all' || content === 'routes') result.routes = Routes.getRoutes();
    if (content === 'all' || content === 'drawings') result.drawings = Drawing.getDrawings();
    if (content === 'activity') {
      const act = Activity.getLastActivity();
      if (act.track.length) result.track = act.track;
    }
    return result;
  }

  function toGPX(data) {
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Antigravity" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Antigravity Export</name><time>${new Date().toISOString()}</time></metadata>\n`;

    data.routes.forEach(r => {
      gpx += `  <rte><name>${esc(r.name)}</name>\n`;
      r.waypoints.forEach(w => {
        gpx += `    <rtept lat="${w.lat}" lon="${w.lng}"></rtept>\n`;
      });
      gpx += `  </rte>\n`;
    });

    data.drawings.forEach(d => {
      if (d.geometry.type === 'Point') {
        gpx += `  <wpt lat="${d.geometry.coordinates[1]}" lon="${d.geometry.coordinates[0]}"><name>${esc(d.label)}</name></wpt>\n`;
      }
    });

    if (data.track.length) {
      gpx += `  <trk><name>Activity Track</name><trkseg>\n`;
      data.track.forEach(p => {
        gpx += `    <trkpt lat="${p.lat}" lon="${p.lng}">${p.alt != null ? `<ele>${p.alt}</ele>` : ''}<time>${new Date(p.time).toISOString()}</time></trkpt>\n`;
      });
      gpx += `  </trkseg></trk>\n`;
    }

    gpx += `</gpx>`;
    return gpx;
  }

  function toKML(data) {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document><name>Antigravity Export</name>\n`;

    data.routes.forEach(r => {
      const coords = (r.routeGeometry ? r.routeGeometry.coordinates : r.waypoints.map(w => [w.lng, w.lat]))
        .map(c => `${c[0]},${c[1]},0`).join(' ');
      kml += `  <Placemark><name>${esc(r.name)}</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark>\n`;
    });

    data.drawings.forEach(d => {
      if (d.geometry.type === 'Point') {
        kml += `  <Placemark><name>${esc(d.label)}</name><Point><coordinates>${d.geometry.coordinates[0]},${d.geometry.coordinates[1]},0</coordinates></Point></Placemark>\n`;
      } else if (d.geometry.type === 'LineString') {
        const c = d.geometry.coordinates.map(p => `${p[0]},${p[1]},0`).join(' ');
        kml += `  <Placemark><name>${esc(d.label)}</name><LineString><coordinates>${c}</coordinates></LineString></Placemark>\n`;
      } else if (d.geometry.type === 'Polygon') {
        const c = d.geometry.coordinates[0].map(p => `${p[0]},${p[1]},0`).join(' ');
        kml += `  <Placemark><name>${esc(d.label)}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${c}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>\n`;
      }
    });

    if (data.track.length) {
      const c = data.track.map(p => `${p.lng},${p.lat},${p.alt||0}`).join(' ');
      kml += `  <Placemark><name>Activity Track</name><LineString><coordinates>${c}</coordinates></LineString></Placemark>\n`;
    }

    kml += `</Document></kml>`;
    return kml;
  }

  function toGeoJSON(data) {
    const features = [];

    data.routes.forEach(r => {
      features.push({
        type: 'Feature',
        properties: { name: r.name, type: 'route', distance: r.distance, duration: r.duration },
        geometry: r.routeGeometry || { type: 'LineString', coordinates: r.waypoints.map(w => [w.lng, w.lat]) }
      });
    });

    data.drawings.forEach(d => {
      features.push({
        type: 'Feature',
        properties: { name: d.label, type: d.type },
        geometry: d.geometry
      });
    });

    if (data.track.length) {
      features.push({
        type: 'Feature',
        properties: { name: 'Activity Track', type: 'track' },
        geometry: { type: 'LineString', coordinates: data.track.map(p => [p.lng, p.lat, p.alt || 0]) }
      });
    }

    return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
  }

  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { doExport };
})();
