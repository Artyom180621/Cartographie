/* ============================================
   Activity - GPS tracking & telemetry
   ============================================ */
const Activity = (() => {
  let isRecording = false;
  let watchId = null;
  let track = [];
  let startTime = null;
  let timerInterval = null;
  let totalDistance = 0;

  function init() {}

  function toggle() {
    const panel = document.getElementById('activity-panel');
    if (panel.classList.contains('show')) {
      panel.classList.remove('show');
    } else {
      panel.classList.add('show');
    }
  }

  function toggleRecording() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  function startRecording() {
    if (!navigator.geolocation) {
      showToast('Géolocalisation non disponible', 'error');
      return;
    }

    isRecording = true;
    track = [];
    totalDistance = 0;
    startTime = Date.now();

    const btn = document.getElementById('act-toggle');
    btn.classList.add('recording');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

    timerInterval = setInterval(updateTimer, 1000);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, altitude, speed } = pos.coords;
        const point = { lat: latitude, lng: longitude, alt: altitude, speed: speed, time: Date.now() };

        if (track.length > 0) {
          const prev = track[track.length - 1];
          totalDistance += Geo.haversine(prev.lat, prev.lng, latitude, longitude);
        }

        track.push(point);
        updateDisplay(point);
        updateTrackOnMap();
      },
      (err) => {
        console.error('GPS error:', err);
        showToast('Erreur GPS: ' + err.message, 'error');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    showToast('Enregistrement GPS démarré', 'success');
  }

  function stopRecording() {
    isRecording = false;
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    clearInterval(timerInterval);

    const btn = document.getElementById('act-toggle');
    btn.classList.remove('recording');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

    if (track.length > 0) {
      saveActivity();
      showToast(`Activité enregistrée: ${Geo.fmtDist(totalDistance)}`, 'success');
    }
  }

  async function saveActivity() {
    const activity = {
      id: 'act_' + Date.now(),
      track: track.map(p => ({ lat: p.lat, lng: p.lng, alt: p.alt, time: p.time })),
      distance: totalDistance,
      duration: Date.now() - startTime,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString()
    };
    await Storage.put('activities', activity);
  }

  function updateDisplay(point) {
    document.getElementById('act-distance').textContent = (totalDistance / 1000).toFixed(2);
    const speed = point.speed != null && point.speed >= 0 ? (point.speed * 3.6).toFixed(1) : '0.0';
    document.getElementById('act-speed').textContent = speed;
    const alt = point.alt != null ? Math.round(point.alt) : '--';
    document.getElementById('act-altitude').textContent = alt;
  }

  function updateTimer() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const display = h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    document.getElementById('act-duration').textContent = display;
  }

  function updateTrackOnMap() {
    const map = MapEngine.getMap();
    if (!map || !map.getSource('activity-track')) return;
    const coords = track.map(p => [p.lng, p.lat]);
    map.getSource('activity-track').setData({
      type: 'Feature', geometry: { type: 'LineString', coordinates: coords }
    });
  }

  function getTrack() { return track; }
  function getIsRecording() { return isRecording; }
  function getLastActivity() {
    return { track, distance: totalDistance, duration: startTime ? Date.now() - startTime : 0, startTime };
  }

  return { init, toggle, toggleRecording, startRecording, stopRecording, getTrack, getIsRecording, getLastActivity };
})();
