import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { DriveRoute } from './types'

const emptyCollection = { type: 'FeatureCollection' as const, features: [] }

export function installManeuverPreview(map: MapLibreMap): void {
  map.addSource('next-maneuver', { type: 'geojson', data: emptyCollection })
  map.addLayer({
    id: 'next-maneuver-ground', type: 'circle', source: 'next-maneuver', minzoom: 15,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 8, 19.5, 17, 21, 23],
      'circle-color': '#f5b72e', 'circle-opacity': .28,
      'circle-stroke-color': '#fff4cf', 'circle-stroke-width': 2,
      'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'map',
    },
  })
  map.addLayer({
    id: 'next-maneuver-raised', type: 'symbol', source: 'next-maneuver', minzoom: 15,
    layout: {
      'icon-image': 'route-direction-arrow', 'icon-size': ['interpolate', ['linear'], ['zoom'], 15, .9, 19.5, 1.5, 21, 2],
      'icon-rotate': ['get', 'bearing'], 'icon-allow-overlap': true,
      'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map',
      'symbol-height-offset': 10, 'symbol-height-anchor': 'ground',
      'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 2.5],
      'text-allow-overlap': true, 'text-font': ['Noto Sans Regular'],
    },
    paint: { 'text-color': '#fff4cf', 'text-halo-color': '#11202b', 'text-halo-width': 2 },
  })
}

export function updateNextManeuver(map: MapLibreMap, route: DriveRoute, distanceM: number): void {
  const next = route.points.find((point) => point.distanceM > distanceM + 35 && point.distanceM < distanceM + 420 && point.curvature >= .045)
  const features = next ? [{
    type: 'Feature' as const,
    properties: {
      bearing: next.bearingDeg,
      label: `PRÓXIMO GIRO · ${Math.max(40, Math.round((next.distanceM - distanceM) / 10) * 10)} m`,
    },
    geometry: { type: 'Point' as const, coordinates: [...next.coordinate] },
  }] : []
  const source = map.getSource('next-maneuver') as GeoJSONSource | undefined
  source?.setData({ type: 'FeatureCollection', features })
}
