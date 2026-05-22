/* ============================================
   Styles - Base map tile URLs (raster only)
   Multi-couche : chaque basemap est un layer
   indépendant que l'on peut superposer.
   ============================================ */

/* OpenAIP shared config */
const OPENAIP_STORAGE_KEY = 'openaip-api-key';
const OPENAIP_DEFAULT_KEY = '36a32b32abc2c2eb64d4b976915d0d39';

// Auto-save default key if none stored
if (!localStorage.getItem(OPENAIP_STORAGE_KEY)) {
  localStorage.setItem(OPENAIP_STORAGE_KEY, OPENAIP_DEFAULT_KEY);
}

function getOpenAIPKey() {
  return localStorage.getItem(OPENAIP_STORAGE_KEY) || OPENAIP_DEFAULT_KEY;
}

const MapStyles = {
  streets: {
    name: 'Rues',
    icon: '🏙️',
    tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
    tileSize: 256,
    maxzoom: 20,
    label: 'Carto Dark'
  },
  satellite: {
    name: 'Satellite',
    icon: '🛰️',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    tileSize: 256,
    maxzoom: 19,
    label: 'Satellite Esri'
  },
  topo: {
    name: 'Topo',
    icon: '🏔️',
    tiles: [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png'
    ],
    tileSize: 256,
    maxzoom: 17,
    label: 'OpenTopoMap'
  },
  ign: {
    name: 'Plan IGN',
    icon: '🗺️',
    tiles: [
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
    ],
    tileSize: 256,
    maxzoom: 18,
    label: 'Plan IGN'
  },
  aero: {
    name: 'Cartes Aéro',
    icon: '✈️',
    tiles: [], // Dynamic — set from API key
    tileSize: 256,
    maxzoom: 14,
    label: 'OpenAIP Complet',
    isOpenAIP: true,
    endpoint: 'openaip' // Combined: airspaces + airports + navaids + reporting points
  },
  drone: {
    name: 'Zones Drone',
    icon: '🛩️',
    tiles: [], // Dynamic — set from API key
    tileSize: 256,
    maxzoom: 14,
    label: 'Espaces aériens',
    isOpenAIP: true,
    endpoint: 'airspaces' // Airspaces only — relevant for drone restrictions
  }
};

/* State : order + visibility + opacity for each basemap layer */
const BasemapState = (() => {
  const DEFAULT_ORDER = ['streets', 'satellite', 'topo', 'ign', 'aero', 'drone'];

  function loadState() {
    try {
      const saved = localStorage.getItem('basemap-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration: remove old 'drone' only entry if 'aero' is missing
        if (parsed.order && !parsed.order.includes('aero')) {
          return null; // Force reset to get new defaults
        }
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function saveState() {
    try {
      localStorage.setItem('basemap-state', JSON.stringify({
        order: state.order,
        visible: state.visible,
        opacity: state.opacity
      }));
    } catch (e) {}
  }

  const saved = loadState();

  const state = {
    order: saved?.order || [...DEFAULT_ORDER],
    visible: saved?.visible || { streets: true, satellite: false, topo: false, ign: false, aero: false, drone: false },
    opacity: saved?.opacity || { streets: 100, satellite: 100, topo: 100, ign: 100, aero: 70, drone: 70 }
  };

  // Ensure all keys exist (in case new basemaps were added)
  for (const key of DEFAULT_ORDER) {
    if (!state.order.includes(key)) state.order.push(key);
    if (state.visible[key] === undefined) state.visible[key] = false;
    if (state.opacity[key] === undefined) state.opacity[key] = (key === 'aero' || key === 'drone') ? 70 : 100;
  }

  return {
    get order() { return state.order; },
    set order(v) { state.order = v; saveState(); },
    get visible() { return state.visible; },
    get opacity() { return state.opacity; },

    setVisible(key, val) { state.visible[key] = val; saveState(); },
    setOpacity(key, val) { state.opacity[key] = val; saveState(); },
    save: saveState
  };
})();

/* Build OpenAIP tile URL from endpoint + key */
function openAIPTileUrl(endpoint) {
  const key = getOpenAIPKey();
  return `https://api.tiles.openaip.net/api/data/${endpoint}/{z}/{x}/{y}.png?apiKey=${key}`;
}

/* Le style MapLibre unique et permanent — jamais remplacé */
const BASE_STYLE = (() => {
  const sources = {};
  const layers = [];

  for (const key of BasemapState.order) {
    const def = MapStyles[key];
    if (!def) continue;

    if (def.isOpenAIP) {
      const apiKey = getOpenAIPKey();
      if (apiKey) {
        sources[`basemap-${key}`] = {
          type: 'raster',
          tiles: [openAIPTileUrl(def.endpoint)],
          tileSize: def.tileSize,
          maxzoom: def.maxzoom
        };
      } else {
        // Transparent 1x1 placeholder
        sources[`basemap-${key}`] = {
          type: 'raster',
          tiles: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAANSURBVAjXY2BgYPgPAAEEAQB9ssjSAAAAAElFTkSuQmCC'],
          tileSize: def.tileSize,
          maxzoom: def.maxzoom
        };
      }
    } else {
      sources[`basemap-${key}`] = {
        type: 'raster',
        tiles: def.tiles,
        tileSize: def.tileSize,
        maxzoom: def.maxzoom
      };
    }

    const isVisible = BasemapState.visible[key];
    const opacity = (BasemapState.opacity[key] || 100) / 100;

    layers.push({
      id: `basemap-${key}-layer`,
      type: 'raster',
      source: `basemap-${key}`,
      layout: { visibility: isVisible ? 'visible' : 'none' },
      paint: { 'raster-opacity': opacity }
    });
  }

  return {
    version: 8,
    name: 'Cartographe',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers
  };
})();
