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
    'basemap': {
      type: 'raster',
      tiles: MapStyles.streets.tiles,
      tileSize: MapStyles.streets.tileSize,
      maxzoom: MapStyles.streets.maxzoom
    }
  },
  layers: [
    { id: 'basemap-layer', type: 'raster', source: 'basemap' }
  ]
};
