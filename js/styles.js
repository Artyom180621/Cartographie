/* ============================================
   Styles - Base map tile URLs (raster only)
   On ne change JAMAIS le style MapLibre.
   On change juste l'URL des tuiles du fond.
   ============================================ */
const MapStyles = {
  streets: {
    name: 'Rues',
    tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
    tileSize: 256,
    maxzoom: 20,
    label: 'Carto Dark'
  },
  satellite: {
    name: 'Satellite',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    tileSize: 256,
    maxzoom: 19,
    label: 'Satellite Esri'
  },
  topo: {
    name: 'Topo',
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
    tiles: [
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
    ],
    tileSize: 256,
    maxzoom: 18,
    label: 'Plan IGN'
  }
};

/* Le style MapLibre unique et permanent — jamais remplacé */
const BASE_STYLE = {
  version: 8,
  name: 'Cartographe',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'basemap-streets': {
      type: 'raster',
      tiles: MapStyles.streets.tiles,
      tileSize: MapStyles.streets.tileSize,
      maxzoom: MapStyles.streets.maxzoom
    },
    'basemap-satellite': {
      type: 'raster',
      tiles: MapStyles.satellite.tiles,
      tileSize: MapStyles.satellite.tileSize,
      maxzoom: MapStyles.satellite.maxzoom
    },
    'basemap-topo': {
      type: 'raster',
      tiles: MapStyles.topo.tiles,
      tileSize: MapStyles.topo.tileSize,
      maxzoom: MapStyles.topo.maxzoom
    },
    'basemap-ign': {
      type: 'raster',
      tiles: MapStyles.ign.tiles,
      tileSize: MapStyles.ign.tileSize,
      maxzoom: MapStyles.ign.maxzoom
    }
  },
  layers: [
    { id: 'basemap-streets-layer', type: 'raster', source: 'basemap-streets', layout: { visibility: 'visible' } },
    { id: 'basemap-satellite-layer', type: 'raster', source: 'basemap-satellite', layout: { visibility: 'none' } },
    { id: 'basemap-topo-layer', type: 'raster', source: 'basemap-topo', layout: { visibility: 'none' } },
    { id: 'basemap-ign-layer', type: 'raster', source: 'basemap-ign', layout: { visibility: 'none' } }
  ]
};

