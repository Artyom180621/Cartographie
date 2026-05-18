/* ============================================
   Routes - Itinerary creation & management
   ============================================ */
const Routes = (() => {
  let routes = [];
  let currentRoute = null;
  let isEditing = false;
  let markers = [];
  const COLORS = ['#6382ff', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#60a5fa', '#f472b6'];

  function init() {
    loadRoutes();
  }

  async function loadRoutes() {
    routes = await Storage.getAll('routes');
    renderRouteList();
    renderSavedRoutesOnMap();
  }

  function createNew() {
    currentRoute = {
      id: 'route_' + Date.now(),
      name: 'Itinéraire ' + (routes.length + 1),
      waypoints: [],
      routeGeometry: null,
      color: COLORS[routes.length % COLORS.length],
      createdAt: new Date().toISOString()
    };
    isEditing = true;
    document.getElementById('route-editor').style.display = 'block';
    document.getElementById('route-name').value = currentRoute.name;
    updateWaypointList();
    setTool('waypoint');
    closeSidebarOnMobile();
    showToast('Cliquez sur la carte pour ajouter des points de passage', 'info');
  }

  function addWaypoint(lngLat) {
    if (!isEditing || !currentRoute) return;
    currentRoute.waypoints.push({ lng: lngLat.lng, lat: lngLat.lat });
    updateWaypointList();
    updateRoutePreview();

    // Add marker
    const el = document.createElement('div');
    el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#6382ff;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:grab;';
    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([lngLat.lng, lngLat.lat])
      .addTo(MapEngine.getMap());

    const idx = markers.length;
    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      currentRoute.waypoints[idx] = { lng: pos.lng, lat: pos.lat };
      updateRoutePreview();
      updateWaypointList();
    });
    markers.push(marker);
  }

  function removeWaypoint(index) {
    currentRoute.waypoints.splice(index, 1);
    if (markers[index]) { markers[index].remove(); markers.splice(index, 1); }
    updateWaypointList();
    updateRoutePreview();
  }

  function updateWaypointList() {
    const list = document.getElementById('waypoint-list');
    if (!currentRoute || currentRoute.waypoints.length === 0) {
      list.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Aucun point ajouté</p>';
      return;
    }
    list.innerHTML = currentRoute.waypoints.map((wp, i) => {
      const dotClass = i === 0 ? 'start' : (i === currentRoute.waypoints.length - 1 ? 'end' : '');
      const label = i === 0 ? 'Départ' : (i === currentRoute.waypoints.length - 1 ? 'Arrivée' : `Point ${i}`);
      return `
        <li class="waypoint-item">
          <span class="waypoint-dot ${dotClass}"></span>
          <span>${label} <small style="color:var(--text-muted)">(${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)})</small></span>
          <span class="waypoint-remove" onclick="Routes.removeWaypoint(${i})">✕</span>
        </li>`;
    }).join('');
  }

  function updateRoutePreview() {
    const map = MapEngine.getMap();
    if (!map || !currentRoute) return;
    const coords = currentRoute.waypoints.map(w => [w.lng, w.lat]);

    map.getSource('route-line')?.setData({
      type: 'Feature', geometry: { type: 'LineString', coordinates: coords }
    });
    map.getSource('route-line-border')?.setData({
      type: 'Feature', geometry: { type: 'LineString', coordinates: coords }
    });
    map.getSource('route-points')?.setData({
      type: 'FeatureCollection',
      features: coords.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c } }))
    });
  }

  async function calcRoute() {
    if (!currentRoute || currentRoute.waypoints.length < 2) {
      showToast('Ajoutez au moins 2 points de passage', 'error');
      return;
    }
    const coords = currentRoute.waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    try {
      showToast('Calcul du trajet en cours...', 'info');
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.routes && data.routes[0]) {
        const geom = data.routes[0].geometry;
        currentRoute.routeGeometry = geom;
        currentRoute.distance = data.routes[0].distance;
        currentRoute.duration = data.routes[0].duration;

        const map = MapEngine.getMap();
        map.getSource('route-line')?.setData({ type: 'Feature', geometry: geom });
        map.getSource('route-line-border')?.setData({ type: 'Feature', geometry: geom });

        const dist = (data.routes[0].distance / 1000).toFixed(1);
        const dur = Math.round(data.routes[0].duration / 60);
        showToast(`Trajet calculé : ${dist} km, ~${dur} min`, 'success');
      }
    } catch (e) {
      showToast('Erreur de calcul de trajet. Vérifiez votre connexion.', 'error');
      console.error(e);
    }
  }

  async function saveCurrentRoute() {
    if (!currentRoute) return;
    currentRoute.name = document.getElementById('route-name').value || currentRoute.name;
    await Storage.put('routes', currentRoute);
    if (!routes.find(r => r.id === currentRoute.id)) routes.push(currentRoute);
    else {
      const idx = routes.findIndex(r => r.id === currentRoute.id);
      routes[idx] = currentRoute;
    }
    cancelEdit();
    renderRouteList();
    renderSavedRoutesOnMap();
    showToast(`Itinéraire "${currentRoute.name}" sauvegardé`, 'success');
  }

  function cancelEdit() {
    isEditing = false;
    currentRoute = null;
    markers.forEach(m => m.remove());
    markers = [];
    document.getElementById('route-editor').style.display = 'none';
    const map = MapEngine.getMap();
    if (map) {
      map.getSource('route-line')?.setData({ type: 'FeatureCollection', features: [] });
      map.getSource('route-line-border')?.setData({ type: 'FeatureCollection', features: [] });
      map.getSource('route-points')?.setData({ type: 'FeatureCollection', features: [] });
    }
    setTool('select');
  }

  async function deleteRoute(id) {
    await Storage.remove('routes', id);
    routes = routes.filter(r => r.id !== id);
    renderRouteList();
    renderSavedRoutesOnMap();
    showToast('Itinéraire supprimé', 'info');
  }

  function focusRoute(id) {
    const route = routes.find(r => r.id === id);
    if (!route || !route.waypoints.length) return;
    const map = MapEngine.getMap();
    const bounds = new maplibregl.LngLatBounds();
    route.waypoints.forEach(w => bounds.extend([w.lng, w.lat]));
    map.fitBounds(bounds, { padding: 80, duration: 1000 });
  }

  function renderRouteList() {
    const container = document.getElementById('route-list');
    if (!routes.length) {
      container.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px">Aucun itinéraire sauvegardé.<br>Cliquez "Nouvel Itinéraire" pour commencer.</p>';
      return;
    }
    container.innerHTML = routes.map(r => {
      const dist = r.distance ? (r.distance / 1000).toFixed(1) + ' km' : `${r.waypoints.length} pts`;
      const dur = r.duration ? Math.round(r.duration / 60) + ' min' : '';
      return `
        <div class="route-item" onclick="Routes.focusRoute('${r.id}')">
          <div class="route-item-header">
            <span class="route-item-name" style="color:${r.color}">● ${r.name}</span>
            <div class="route-item-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Routes.deleteRoute('${r.id}')" title="Supprimer">🗑</button>
            </div>
          </div>
          <div class="route-item-meta">
            <span>📏 ${dist}</span>
            ${dur ? `<span>⏱ ${dur}</span>` : ''}
            <span>📅 ${new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>`;
    }).join('');
  }

  function renderSavedRoutesOnMap() {
    const map = MapEngine.getMap();
    if (!map) return;
    const features = routes.filter(r => r.waypoints.length >= 2).map(r => ({
      type: 'Feature',
      properties: { color: r.color, name: r.name },
      geometry: r.routeGeometry || { type: 'LineString', coordinates: r.waypoints.map(w => [w.lng, w.lat]) }
    }));
    Layers.setSourceData(map, 'saved-routes', { type: 'FeatureCollection', features });
  }

  function isCurrentlyEditing() { return isEditing; }
  function getCurrentRoute() { return currentRoute; }
  function getRoutes() { return routes; }

  return { init, createNew, addWaypoint, removeWaypoint, calcRoute, saveCurrentRoute, cancelEdit, deleteRoute, focusRoute, isCurrentlyEditing, getCurrentRoute, getRoutes, loadRoutes, renderSavedRoutesOnMap };
})();
