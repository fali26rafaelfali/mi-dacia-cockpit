import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Coordinate } from './types'

export interface MapWeather {
  temperatureC: number
  code: number
  isDay: boolean
  label: string
  wet: boolean
  fog: boolean
}

interface OpenMeteoPayload {
  current?: { temperature_2m?: number; weather_code?: number; is_day?: number }
}

function weatherLabel(code: number): string {
  if (code === 0) return 'Despejado'
  if (code <= 3) return 'Nubes'
  if (code === 45 || code === 48) return 'Niebla'
  if (code <= 57) return 'Llovizna'
  if (code <= 67) return 'Lluvia'
  if (code <= 77) return 'Nieve'
  if (code <= 82) return 'Chubascos'
  if (code >= 95) return 'Tormenta'
  return 'Variable'
}

export async function loadRealWeather(coordinate: Coordinate, signal: AbortSignal): Promise<MapWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(coordinate[1]))
  url.searchParams.set('longitude', String(coordinate[0]))
  url.searchParams.set('current', 'temperature_2m,weather_code,is_day')
  url.searchParams.set('timezone', 'auto')
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`)
  const current = ((await response.json()) as OpenMeteoPayload).current
  if (!current || current.temperature_2m === undefined || current.weather_code === undefined) {
    throw new Error('Open-Meteo no devolvió las condiciones actuales')
  }
  const code = current.weather_code
  return {
    temperatureC: current.temperature_2m,
    code,
    isDay: current.is_day === 1,
    label: weatherLabel(code),
    wet: code >= 51 && code <= 99,
    fog: code === 45 || code === 48,
  }
}

export function applyMapWeather(map: MapLibreMap, host: HTMLElement, weather: MapWeather): void {
  const hour = new Date().getHours()
  const sunAzimuth = ((hour - 6) / 12) * 180 + 90
  const night = !weather.isDay
  const cloudy = weather.code >= 1
  map.setLight({
    anchor: 'map',
    color: night ? '#8ab4e8' : cloudy ? '#e2e7eb' : '#fff1d5',
    intensity: night ? .25 : cloudy ? .5 : .72,
    position: [1.25, sunAzimuth, night ? 25 : 48],
  })
  map.setSky({
    'sky-color': night ? '#050c19' : cloudy ? '#9aa9b4' : '#6eb7e8',
    'horizon-color': night ? '#17243b' : weather.fog ? '#c7c9c6' : '#d7e9f2',
    'fog-color': weather.fog ? '#c7c9c6' : night ? '#111c2d' : '#d6e8ef',
    'horizon-fog-blend': weather.fog ? .85 : .15,
    'atmosphere-blend': night ? .75 : .55,
  })
  host.classList.toggle('cockpit-map-wrap--night', night)
  host.classList.toggle('cockpit-map-wrap--wet', weather.wet)
  host.classList.toggle('cockpit-map-wrap--fog', weather.fog)
}

export function installAdaptiveQuality(map: MapLibreMap, report: (quality: string) => void): () => void {
  let previousQuality = ''
  const update = () => {
    const zoom = map.getZoom()
    const quality = zoom >= 18 ? 'Detalle cercano' : zoom >= 16.5 ? 'Equilibrado' : 'Relieve'
    if (quality !== previousQuality) {
      previousQuality = quality
      report(quality)
    }
    if (map.getLayer('osm-trees')) map.setLayoutProperty('osm-trees', 'visibility', zoom >= 17 ? 'visible' : 'none')
    if (map.getLayer('osm-lamps')) map.setLayoutProperty('osm-lamps', 'visibility', zoom >= 16.5 ? 'visible' : 'none')
    if (map.getLayer('osm-signs')) map.setLayoutProperty('osm-signs', 'visibility', zoom >= 15.5 ? 'visible' : 'none')
    if (map.getLayer('osm-peaks')) map.setLayoutProperty('osm-peaks', 'visibility', zoom < 17.8 ? 'visible' : 'none')
    if (map.getLayer('building-3d')) {
      map.setPaintProperty('building-3d', 'fill-extrusion-opacity', zoom >= 18 ? .94 : zoom >= 16.5 ? .88 : .76)
    }
    // Las alturas permanecen a escala real a cualquier nivel de zoom.
  }
  map.on('zoomend', update)
  update()
  return () => map.off('zoomend', update)
}
