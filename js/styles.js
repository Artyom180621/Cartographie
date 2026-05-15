/* ============================================
   Styles - Map tile source definitions
   ============================================ */
const MapStyles = {
  streets: {
    name: 'Rues',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    label: 'OSM Dark'
  },
  satellite: {
    name: 'Satellite',
    url: {
      version: 8, name: 'Satellite IGN',
      sources: {
        'esri-fallback': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256, maxzoom: 19, attribution: '&copy; Esri, Maxar'
        },
        'satellite-tiles': {
          type: 'raster',
          tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'],
          tileSize: 256, maxzoom: 19, attribution: '&copy; IGN France'
        }
      },
      layers: [
        { id: 'esri-fallback-layer', type: 'raster', source: 'esri-fallback', minzoom: 0, maxzoom: 19 },
        { id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', minzoom: 0, maxzoom: 19 }
      ]
    },
    label: 'IGN Ortho + Esri'
  },
  topo: {
    name: 'Topo',
    url: {
      version: 8, name: 'OpenTopoMap',
      sources: {
        'topo-tiles': {
          type: 'raster',
          tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],
          tileSize: 256, maxzoom: 17, attribution: '&copy; OpenTopoMap (CC-BY-SA)'
        }
      },
      layers: [{ id: 'topo-layer', type: 'raster', source: 'topo-tiles', minzoom: 0, maxzoom: 17 }]
    },
    label: 'OpenTopoMap'
  },
  ign: {
    name: 'Plan IGN',
    url: {
      version: 8, name: 'Plan IGN',
      sources: {
        'ign-plan-tiles': {
          type: 'raster',
          tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'],
          tileSize: 256, maxzoom: 18, attribution: '&copy; IGN France'
        }
      },
      layers: [{ id: 'ign-plan-layer', type: 'raster', source: 'ign-plan-tiles', minzoom: 0, maxzoom: 18 }]
    },
    label: 'Plan IGN'
  }
};
