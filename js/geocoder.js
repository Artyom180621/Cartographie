/* ============================================
   Geocoder - Address search via Nominatim
   ============================================ */
const Geocoder = (() => {
  let debounceTimer = null;

  function init() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (q.length < 2) { results.classList.remove('show'); return; }

      // Check if it's coordinates (lat, lng)
      const coordMatch = q.match(/^(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          showCoordResult(lat, lng, results);
          return;
        }
      }

      debounceTimer = setTimeout(() => searchNominatim(q, results), 400);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { results.classList.remove('show'); input.blur(); }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) results.classList.remove('show');
    });
  }

  function showCoordResult(lat, lng, container) {
    container.innerHTML = `
      <div class="search-result-item" onclick="Geocoder.goTo(${lat}, ${lng}, 14)">
        <div class="search-result-name">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        <div class="search-result-detail">Aller aux coordonnées</div>
      </div>`;
    container.classList.add('show');
  }

  async function searchNominatim(query, container) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`;
      const resp = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
      const data = await resp.json();

      if (!data.length) {
        container.innerHTML = '<div class="search-result-item"><div class="search-result-name" style="color:var(--text-muted)">Aucun résultat</div></div>';
        container.classList.add('show');
        return;
      }

      container.innerHTML = data.map(r => `
        <div class="search-result-item" onclick="Geocoder.goTo(${r.lat}, ${r.lon}, 14)">
          <div class="search-result-name">${r.display_name.split(',').slice(0, 2).join(', ')}</div>
          <div class="search-result-detail">${r.display_name}</div>
        </div>
      `).join('');
      container.classList.add('show');
    } catch (e) {
      console.error('Geocoder error:', e);
    }
  }

  function goTo(lat, lng, zoom) {
    const map = MapEngine.getMap();
    if (!map) return;

    // Remove old search marker
    document.querySelectorAll('.search-marker').forEach(m => m.remove());

    map.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 1500 });

    const el = document.createElement('div');
    el.className = 'search-marker';
    el.style.cssText = 'width:24px;height:24px;border-radius:50%;background:var(--accent);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;';
    new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);

    document.getElementById('search-results').classList.remove('show');
    document.getElementById('search-input').value = '';
  }

  return { init, goTo };
})();
