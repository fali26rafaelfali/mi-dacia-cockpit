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

export function foodRouteSegments(route: DriveRoute): Coordinate[][] {
  // Conserva las curvas también en viajes largos; no une toda la ruta con solo 28 puntos.
  const points = route.points.filter((point, index) => index === 0 || index === route.points.length - 1 ||
    Math.floor(point.distanceM / 150) !== Math.floor(route.points[index - 1].distanceM / 150))
  const segments: Coordinate[][] = []
  for (let index = 0; index < points.length - 1; index += 119) {
    segments.push(points.slice(index, index + 120).map(({ coordinate }) => coordinate))
  }
  return segments
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
  const elements: OsmElement[] = []
  for (const segment of foodRouteSegments(route)) {
    const line = segment.flatMap(([longitude, latitude]) => [latitude.toFixed(6), longitude.toFixed(6)]).join(',')
    const query = `[out:json][timeout:20];nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](around:1200,${line});out center;`
    let succeeded = false
    let lastError: unknown
    for (const endpoint of overpassEndpoints()) {
      const controller = new AbortController()
      const abort = () => controller.abort()
      if (signal?.aborted) throw new Error('Consulta cancelada')
      signal?.addEventListener('abort', abort, { once: true })
      const timer = window.setTimeout(abort, 25_000)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Overpass respondió ${response.status}`)
        const payload = await response.json() as { elements?: OsmElement[]; remark?: string }
        if (!Array.isArray(payload.elements) || payload.remark) throw new Error('Consulta incompleta')
        elements.push(...payload.elements)
        succeeded = true
        break
      } catch (error) {
        if (signal?.aborted) throw error
        lastError = error
      } finally {
        window.clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
      }
    }
    if (!succeeded) throw lastError ?? new Error('No hay ningún servidor Overpass disponible')
  }
  return parseFoodStops(elements, route)
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

export function selectFoodStopsAhead(stops: FoodStop[], currentDistanceM: number): FoodStop[] {
  return stops
    .filter((stop) => stop.routeDistanceM >= currentDistanceM)
    .sort((a, b) => a.routeDistanceM - b.routeDistanceM || a.detourM - b.detourM)
}
