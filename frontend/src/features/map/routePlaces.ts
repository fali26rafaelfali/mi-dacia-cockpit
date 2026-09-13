import { distanceBetween } from './route'
import type { Coordinate, DriveRoute } from './types'

export interface FoodStop {
  id: string
  name: string
  coordinate: Coordinate
  kind: 'restaurant' | 'cafe' | 'fast_food'
  cuisine?: string
  openingHours?: string
  routeDistanceM: number
  detourM: number
}

interface OsmElement {
  id?: number
  type?: string
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string>
}

const overpassEndpoints = () => window.location.hostname.endsWith('.github.io')
  ? [
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://overpass-api.de/api/interpreter',
    ]
  : ['/osm-overpass']

function sampledRoute(route: DriveRoute, maximum = 28): Coordinate[] {
  if (route.points.length <= maximum) return route.points.map(({ coordinate }) => coordinate)
  return Array.from({ length: maximum }, (_, index) =>
    route.points[Math.round(index * (route.points.length - 1) / (maximum - 1))].coordinate)
}

export function parseFoodStops(elements: OsmElement[], route: DriveRoute): FoodStop[] {
  const seen = new Set<string>()
  return elements.flatMap((element) => {
    const tags = element.tags ?? {}
    const latitude = element.lat ?? element.center?.lat
    const longitude = element.lon ?? element.center?.lon
    const kind = tags.amenity
    if (!tags.name || latitude === undefined || longitude === undefined || !['restaurant', 'cafe', 'fast_food'].includes(kind)) return []
    const key = `${tags.name.toLocaleLowerCase('es')}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`
    if (seen.has(key)) return []
    seen.add(key)
    const coordinate = [longitude, latitude] as Coordinate
    const nearest = route.points.reduce((best, point) => {
      const distanceM = distanceBetween(point.coordinate, coordinate)
      return distanceM < best.distanceM ? { point, distanceM } : best
    }, { point: route.points[0], distanceM: Number.POSITIVE_INFINITY })
    if (nearest.distanceM > 1_200) return []
    return [{
      id: `${element.type ?? 'osm'}-${element.id ?? key}`,
      name: tags.name,
      coordinate,
      kind: kind as FoodStop['kind'],
      cuisine: tags.cuisine,
      openingHours: tags.opening_hours,
      routeDistanceM: nearest.point.distanceM,
      detourM: nearest.distanceM,
    }]
  })
}

export async function fetchFoodStops(route: DriveRoute, signal?: AbortSignal): Promise<FoodStop[]> {
  const line = sampledRoute(route).flatMap(([longitude, latitude]) => [latitude.toFixed(6), longitude.toFixed(6)]).join(',')
  const query = `[out:json][timeout:20];nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](around:1200,${line});out center 100;`
  let lastError: unknown
  for (const endpoint of overpassEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      })
      if (!response.ok) throw new Error(`Overpass respondió ${response.status}`)
      const payload = await response.json() as { elements?: OsmElement[] }
      return parseFoodStops(payload.elements ?? [], route)
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
    }
  }
  throw lastError ?? new Error('No hay ningún servidor Overpass disponible')
}

interface ReverseResult {
  display_name?: string
  address?: Record<string, string>
}

export async function fetchMunicipality(coordinate: Coordinate, signal?: AbortSignal): Promise<string> {
  const [longitude, latitude] = coordinate
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: '10', addressdetails: '1', 'accept-language': 'es' })
  const hosted = window.location.hostname.endsWith('.github.io')
  const url = hosted ? `https://nominatim.openstreetmap.org/reverse?${params}` : `/reverse-geocode?lat=${latitude}&lon=${longitude}`
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`Nominatim respondió ${response.status}`)
  const payload = await response.json() as ReverseResult
  const address = payload.address ?? {}
  return address.city ?? address.town ?? address.village ?? address.municipality ?? address.hamlet ?? payload.display_name?.split(',')[0] ?? 'Localidad sin identificar'
}

export function selectFoodStopsAhead(stops: FoodStop[], currentDistanceM: number, maximum = 6): FoodStop[] {
  const candidates = stops
    .filter((stop) => stop.routeDistanceM >= currentDistanceM - 300)
    .sort((a, b) => a.routeDistanceM - b.routeDistanceM || a.detourM - b.detourM)
  const selected: FoodStop[] = []
  for (const stop of candidates) {
    const nearbySelection = selected.find((chosen) => Math.abs(chosen.routeDistanceM - stop.routeDistanceM) < 2_000)
    if (nearbySelection) {
      if (stop.detourM < nearbySelection.detourM) selected[selected.indexOf(nearbySelection)] = stop
      continue
    }
    selected.push(stop)
    if (selected.length === maximum) break
  }
  return selected.sort((a, b) => a.routeDistanceM - b.routeDistanceM)
}
