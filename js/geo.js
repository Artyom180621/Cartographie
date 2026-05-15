/* ============================================
   Geo - Geometry helper functions
   ============================================ */
const Geo = (() => {
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function lineLength(coords) {
    let t = 0;
    for (let i = 1; i < coords.length; i++) t += haversine(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
    return t;
  }

  function polyArea(coords) {
    let area = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = coords[i][0] * Math.PI / 180 * 6371000 * Math.cos(coords[i][1] * Math.PI / 180);
      const yi = coords[i][1] * Math.PI / 180 * 6371000;
      const xj = coords[j][0] * Math.PI / 180 * 6371000 * Math.cos(coords[j][1] * Math.PI / 180);
      const yj = coords[j][1] * Math.PI / 180 * 6371000;
      area += xi * yj - xj * yi;
    }
    return Math.abs(area / 2);
  }

  function circle(center, radiusM, steps = 64) {
    const coords = [], R = 6371000;
    const lat = center[1] * Math.PI / 180, lng = center[0] * Math.PI / 180, d = radiusM / R;
    for (let i = 0; i <= steps; i++) {
      const brng = (2 * Math.PI * i) / steps;
      const latR = Math.asin(Math.sin(lat)*Math.cos(d) + Math.cos(lat)*Math.sin(d)*Math.cos(brng));
      const lngR = lng + Math.atan2(Math.sin(brng)*Math.sin(d)*Math.cos(lat), Math.cos(d)-Math.sin(lat)*Math.sin(latR));
      coords.push([lngR * 180 / Math.PI, latR * 180 / Math.PI]);
    }
    return coords;
  }

  function fmtDist(m) { return m >= 1000 ? (m/1000).toFixed(2) + ' km' : Math.round(m) + ' m'; }
  function fmtArea(m2) { return m2 >= 1e6 ? (m2/1e6).toFixed(2) + ' km²' : Math.round(m2) + ' m²'; }

  return { haversine, lineLength, polyArea, circle, fmtDist, fmtArea };
})();
