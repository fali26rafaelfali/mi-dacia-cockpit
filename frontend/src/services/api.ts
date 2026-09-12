import type { Coordinates, FuelStation, Place, Radar, Route, Weather } from '../core/types'
import { fetchJson, queryString } from './http'

export interface ServiceConfig {
  osrmUrl?: string
  nominatimUrl?: string
  overpassProxyUrl?: string
  dgtProxyUrl?: string
  weatherUrl?: string
  fuelProxyUrl?: string
}

const defaults: Required<ServiceConfig> = {
  osrmUrl: 'https://router.project-osrm.org',
  nominatimUrl: 'https://nominatim.openstreetmap.org',
  overpassProxyUrl: '/osm-overpass',
  dgtProxyUrl: '/api/dgt/radars',
  weatherUrl: 'https://api.open-meteo.com/v1/forecast',
  fuelProxyUrl: '/api/fuel-stations',
}

interface OsrmResponse {
  code: string
  message?: string
  routes: Array<{
    distance: number
    duration: number
    geometry: Route['geometry']
    legs: Array<{
      steps: Array<{
        distance: number
        duration: number
        name: string
        maneuver: Route['steps'][number]['maneuver']
      }>
    }>
  }>
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type?: string
  address?: Record<string, string>
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number
    apparent_temperature?: number
    relative_humidity_2m?: number
    wind_speed_10m?: number
    weather_code?: number
    is_day?: number
    time: string
  }
}

interface OverpassResponse {
  elements: Array<{
    id: number
    lat?: number
    lon?: number
    center?: { lat: number; lon: number }
    tags?: Record<string, string>
  }>
}

const point = (value: Pick<Coordinates, 'latitude' | 'longitude'>): string =>
  `${value.longitude},${value.latitude}`

export function createApiServices(config: ServiceConfig = {}) {
  const urls = { ...defaults, ...config }

  return {
    async route(
      from: Pick<Coordinates, 'latitude' | 'longitude'>,
      to: Pick<Coordinates, 'latitude' | 'longitude'>,
      signal?: AbortSignal,
    ): Promise<Route> {
      const url = `${urls.osrmUrl}/route/v1/driving/${point(from)};${point(to)}?${queryString({
        overview: 'full',
        geometries: 'geojson',
        steps: true,
      })}`
      const data = await fetchJson<OsrmResponse>(url, { signal })
      const route = data.routes[0]
      if (data.code !== 'Ok' || !route) throw new Error(data.message ?? 'OSRM no devolvió una ruta')
      return {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        geometry: route.geometry,
        steps: route.legs.flatMap((leg) =>
          leg.steps.map((step) => ({
            distanceMeters: step.distance,
            durationSeconds: step.duration,
            instruction: [step.maneuver.type, step.maneuver.modifier].filter(Boolean).join(' '),
            name: step.name,
            maneuver: step.maneuver,
          })),
        ),
      }
    },

    async searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
      const url = `${urls.nominatimUrl}/search?${queryString({
        q: query,
        format: 'jsonv2',
        addressdetails: 1,
        limit: 8,
      })}`
      const data = await fetchJson<NominatimResult[]>(url, {
        signal,
        headers: { Accept: 'application/json' },
      })
      return data.map((place) => ({
        id: String(place.place_id),
        displayName: place.display_name,
        latitude: Number(place.lat),
        longitude: Number(place.lon),
        type: place.type,
        address: place.address,
      }))
    },

    async nearbyParking(
      center: Pick<Coordinates, 'latitude' | 'longitude'>,
      radiusMeters = 3_000,
      signal?: AbortSignal,
    ): Promise<Place[]> {
      const query = `[out:json];(node["amenity"="parking"](around:${radiusMeters},${center.latitude},${center.longitude});way["amenity"="parking"](around:${radiusMeters},${center.latitude},${center.longitude}););out center tags;`
      const data = await fetchJson<OverpassResponse>(urls.overpassProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal,
      })
      return data.elements.flatMap((element) => {
        const latitude = element.lat ?? element.center?.lat
        const longitude = element.lon ?? element.center?.lon
        if (latitude === undefined || longitude === undefined) return []
        return [{
          id: `osm-${element.id}`,
          displayName: element.tags?.name ?? 'Aparcamiento',
          latitude,
          longitude,
          type: element.tags?.amenity,
          address: element.tags,
        }]
      })
    },

    async radars(bounds?: string, signal?: AbortSignal): Promise<Radar[]> {
      const separator = urls.dgtProxyUrl.includes('?') ? '&' : '?'
      return fetchJson<Radar[]>(
        `${urls.dgtProxyUrl}${bounds ? `${separator}${queryString({ bounds })}` : ''}`,
        { signal },
      )
    },

    async weather(
      location: Pick<Coordinates, 'latitude' | 'longitude'>,
      signal?: AbortSignal,
    ): Promise<Weather> {
      const url = `${urls.weatherUrl}?${queryString({
        latitude: location.latitude,
        longitude: location.longitude,
        current:
          'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
      })}`
      const data = await fetchJson<OpenMeteoResponse>(url, { signal })
      return {
        temperatureCelsius: data.current.temperature_2m,
        apparentTemperatureCelsius: data.current.apparent_temperature,
        humidityPercent: data.current.relative_humidity_2m,
        windKmh: data.current.wind_speed_10m,
        weatherCode: data.current.weather_code,
        isDay: data.current.is_day === 1,
        observedAt: Date.parse(data.current.time),
      }
    },

    async fuelStations(
      location?: Pick<Coordinates, 'latitude' | 'longitude'>,
      signal?: AbortSignal,
    ): Promise<FuelStation[]> {
      const separator = urls.fuelProxyUrl.includes('?') ? '&' : '?'
      const query = location
        ? queryString({ latitude: location.latitude, longitude: location.longitude })
        : ''
      return fetchJson<FuelStation[]>(`${urls.fuelProxyUrl}${query ? separator + query : ''}`, {
        signal,
      })
    },
  }
}

export const api = createApiServices()
