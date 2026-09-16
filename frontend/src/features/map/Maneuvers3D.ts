import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { DriveRoute } from './types'
import { getNavigationInstruction } from './navigation'

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
      'symbol-height-offset': 5, 'symbol-height-anchor': 'ground',
      'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, -1.8], 'text-anchor': 'bottom', 'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'viewport',
      'text-allow-overlap': true, 'text-font': ['Noto Sans Regular'],
    },
    paint: { 'text-color': '#fff4cf', 'text-halo-color': '#11202b', 'text-halo-width': 2 },
  })
}

export function updateNextManeuver(map: MapLibreMap, route: DriveRoute, distanceM: number): void {
  const navigation = getNavigationInstruction(route, distanceM, 'destino')
  const next = navigation.maneuver && navigation.distanceM <= 150 ? navigation.maneuver : null
  const lanePoint = next ? route.points.reduce((best, point) => Math.abs(point.distanceM - next.distanceM) < Math.abs(best.distanceM - next.distanceM) ? point : best, route.points[0]) : null
  const features = next && lanePoint ? [{
    type: 'Feature' as const,
    properties: {
      bearing: next.bearingAfter ?? route.points.find((point) => point.distanceM >= next.distanceM)?.bearingDeg ?? 0,
      label: `${navigation.shortInstruction.toUpperCase()} · ${navigation.distanceLabel}`,
    },
    geometry: { type: 'Point' as const, coordinates: [...lanePoint.coordinate] },
  }] : []
  const source = map.getSource('next-maneuver') as GeoJSONSource | undefined
  source?.setData({ type: 'FeatureCollection', features })
}
