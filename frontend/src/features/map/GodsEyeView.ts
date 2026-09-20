import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Coordinate, DriveRoute } from './types'

export interface LiveAircraft {
  id: string
  callsign: string
  registration?: string
  coordinate: Coordinate
  altitudeM?: number
  speedKph?: number
  bearingDeg: number
}

interface AircraftResponse {
  aircraft: LiveAircraft[]
  updatedAt: string
}

const emptyContacts = {
  type: 'FeatureCollection' as const,
  features: [],
}

function aircraftGeoJson(aircraft: LiveAircraft[]) {
  return {
    type: 'FeatureCollection' as const,
    features: aircraft.map((item) => ({
      type: 'Feature' as const,
      id: item.id,
      properties: {
        callsign: item.callsign || item.registration || 'AVIÓN',
        bearing: item.bearingDeg,
        altitude: item.altitudeM ? `${Math.round(item.altitudeM / 100) / 10} km` : '',
      },
      geometry: { type: 'Point' as const, coordinates: [...item.coordinate] },
    })),
  }
}

function addAircraftImage(map: MapLibreMap) {
  if (map.hasImage('live-aircraft-icon')) return
  const canvas = document.createElement('canvas')
  canvas.width = 72
  canvas.height = 72
  const context = canvas.getContext('2d')
  if (!context) return
  context.translate(36, 36)
  context.fillStyle = '#f5b72e'
  context.strokeStyle = '#07131d'
  context.lineWidth = 4
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(0, -29)
  context.lineTo(7, -8)
  context.lineTo(27, 3)
  context.lineTo(27, 10)
  context.lineTo(7, 5)
  context.lineTo(5, 22)
  context.lineTo(13, 28)
  context.lineTo(13, 32)
  context.lineTo(0, 28)
  context.lineTo(-13, 32)
  context.lineTo(-13, 28)
  context.lineTo(-5, 22)
  context.lineTo(-7, 5)
  context.lineTo(-27, 10)
  context.lineTo(-27, 3)
  context.lineTo(-7, -8)
  context.closePath()
  context.stroke()
  context.fill()
  map.addImage('live-aircraft-icon', context.getImageData(0, 0, 72, 72), { pixelRatio: 2 })
}

export function installGodsEyeLayers(map: MapLibreMap) {
  addAircraftImage(map)
  map.addSource('live-aircraft', { type: 'geojson', data: emptyContacts })
  map.addLayer({
    id: 'live-aircraft-symbols',
    type: 'symbol',
    source: 'live-aircraft',
    layout: {
      visibility: 'none',
      'icon-image': 'live-aircraft-icon',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, .55, 10, .8, 15, 1],
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'text-field': ['concat', ['get', 'callsign'], '\n', ['get', 'altitude']],
      'text-size': 10,
      'text-offset': [0, 2.2],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#07131d',
      'text-halo-width': 2,
    },
  })
}

export function setGodsEyeLayersVisible(map: MapLibreMap, visible: boolean) {
  if (map.getLayer('live-aircraft-symbols')) {
    map.setLayoutProperty('live-aircraft-symbols', 'visibility', visible ? 'visible' : 'none')
  }
}

export function enterGodsEyeView(map: MapLibreMap, route: DriveRoute, current: Coordinate) {
  // MapLibre no calcula la niebla del cielo en proyección de globo. Retirarla
  // evita el aviso continuo en F12 y deja que el satélite dibuje el horizonte.
  map.setSky(undefined as unknown as maplibregl.SkySpecification)
  map.setProjection({ type: 'globe' })
  const bounds = route.points.reduce(
    (value, point) => value.extend([...point.coordinate]),
    new maplibregl.LngLatBounds([...current], [...current]),
  )
  map.fitBounds(bounds, {
    padding: { top: 150, right: 140, bottom: 190, left: 140 },
    maxZoom: 10.3,
    pitch: 48,
    bearing: 0,
    duration: 1400,
    essential: true,
  })
  setGodsEyeLayersVisible(map, true)
}

export function leaveGodsEyeView(map: MapLibreMap, current: Coordinate, bearing: number) {
  map.setProjection({ type: 'mercator' })
  map.setSky({ 'sky-color': '#80b7d9', 'horizon-color': '#d9e8ed', 'fog-color': '#d9e8ed', 'horizon-fog-blend': .15 })
  setGodsEyeLayersVisible(map, false)
  map.easeTo({ center: [...current], zoom: 17.25, pitch: 69, bearing, duration: 1100, essential: true })
}

export async function loadAircraftNear(
  map: MapLibreMap,
  coordinate: Coordinate,
  signal?: AbortSignal,
): Promise<{ count: number; updatedAt: string }> {
  const params = new URLSearchParams({ lat: String(coordinate[1]), lon: String(coordinate[0]), radius_km: '180' })
  const response = await fetch(`${import.meta.env.BASE_URL}live-aircraft?${params}`, { signal })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('El servidor de datos en vivo no está conectado')
  }
  const data = await response.json() as AircraftResponse
  const source = map.getSource('live-aircraft') as GeoJSONSource | undefined
  source?.setData(aircraftGeoJson(data.aircraft))
  return { count: data.aircraft.length, updatedAt: data.updatedAt }
}
