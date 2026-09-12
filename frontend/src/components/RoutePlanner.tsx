import { useEffect, useId, useState, type FormEvent } from 'react'
import type { Coordinate } from '../features/map/types'

export interface DemoLocation {
  label: string
  coordinate: Coordinate
  address?: string
}

interface GeocodeResult {
  display_name?: string
  lat?: string
  lon?: string
}

const LOCATIONS: DemoLocation[] = [
  { label: 'La Línea', coordinate: [-5.3495, 36.1688] },
  { label: 'San Roque', coordinate: [-5.3843, 36.2105] },
  { label: 'Estepona', coordinate: [-5.1459, 36.4276] },
  { label: 'Algeciras', coordinate: [-5.453, 36.1408] },
  { label: 'Los Barrios', coordinate: [-5.4926, 36.1848] },
  { label: 'Sotogrande', coordinate: [-5.2724, 36.2851] },
  { label: 'Tarifa', coordinate: [-5.6044, 36.013] },
]

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es')

function currentPosition(): Promise<DemoLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Esta tablet no ofrece acceso a la ubicación.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ label: 'Ubicación actual', address: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`, coordinate: [coords.longitude, coords.latitude] }),
      () => reject(new Error('No se pudo obtener la ubicación actual. Revisa el permiso de GPS.')),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
    )
  })
}

function parseResults(results: GeocodeResult[]): DemoLocation[] {
  return results.flatMap((result) => {
    const latitude = Number(result.lat)
    const longitude = Number(result.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !result.display_name) return []
    return [{ label: result.display_name.split(',')[0], address: result.display_name, coordinate: [longitude, latitude] as Coordinate }]
  })
}

async function searchLocations(query: string, signal?: AbortSignal): Promise<DemoLocation[]> {
  const hosted = window.location.hostname.endsWith('.github.io')
  const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: '7', countrycodes: 'es', addressdetails: '1', namedetails: '1', dedupe: '1', 'accept-language': 'es' })
  const url = hosted ? `https://nominatim.openstreetmap.org/search?${params}` : `/geocode?q=${encodeURIComponent(query.trim())}`
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('El buscador de lugares no está disponible.')
  return parseResults(await response.json() as GeocodeResult[])
}

async function resolveLocation(value: string, selected: DemoLocation | null): Promise<DemoLocation> {
  if (selected) return selected
  const query = value.trim()
  if (normalize(query) === 'ubicacion actual') return currentPosition()
  const preset = LOCATIONS.find(({ label }) => normalize(label) === normalize(query))
  if (preset) return preset
  const first = (await searchLocations(query))[0]
  if (!first) throw new Error(`No se encontró “${query}”. Elige uno de los resultados sugeridos.`)
  return first
}

function LocationSearch({ label, value, selected, onChange, onSelect }: {
  label: string
  value: string
  selected: DemoLocation | null
  onChange: (value: string) => void
  onSelect: (location: DemoLocation) => void
}) {
  const id = useId()
  const [results, setResults] = useState<DemoLocation[]>([])
  const [searching, setSearching] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const query = value.trim()
    if (query.length < 2 || selected || normalize(query) === 'ubicacion actual' || LOCATIONS.some(({ label: name }) => normalize(name) === normalize(query))) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      void searchLocations(query, controller.signal).then(setResults).catch(() => setResults([])).finally(() => { if (!controller.signal.aborted) setSearching(false) })
    }, 320)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [selected, value])

  const open = focused && !selected && value.trim().length >= 2
  return (
    <div className="cockpit-location-search">
      <label htmlFor={id}>{label}</label>
      <div className="cockpit-location-search__field">
        <span aria-hidden="true">⌕</span>
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 150)} autoComplete="off" role="combobox" aria-expanded={open} aria-controls={`${id}-results`} placeholder="Calle, lugar o negocio" required />
        {searching && <i aria-label="Buscando" />}
      </div>
      {open && <ul className="cockpit-location-search__results" id={`${id}-results`} role="listbox">
        {results.length ? results.map((location, index) => <li role="option" aria-selected="false" key={`${location.coordinate.join('-')}-${index}`}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(location); setFocused(false); setResults([]) }}><strong>{location.label}</strong><small>{location.address}</small></button></li>) : !searching && <li className="cockpit-location-search__empty">Escribe una dirección más completa</li>}
      </ul>}
    </div>
  )
}

export function RoutePlanner({ fromLabel, toLabel, onClose, onApply }: {
  fromLabel: string
  toLabel: string
  onClose: () => void
  onApply: (from: DemoLocation, to: DemoLocation) => Promise<void>
}) {
  const [from, setFrom] = useState(fromLabel)
  const [to, setTo] = useState(toLabel)
  const [fromLocation, setFromLocation] = useState<DemoLocation | null>(null)
  const [toLocation, setToLocation] = useState<DemoLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const [origin, destination] = await Promise.all([resolveLocation(from, fromLocation), resolveLocation(to, toLocation)])
      if (Math.abs(origin.coordinate[0] - destination.coordinate[0]) < .0001 && Math.abs(origin.coordinate[1] - destination.coordinate[1]) < .0001) throw new Error('El origen y el destino deben ser diferentes.')
      await onApply(origin, destination)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo calcular la ruta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cockpit-dialog-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose() }}>
      <form className="cockpit-dialog cockpit-route-planner" role="dialog" aria-modal="true" aria-labelledby="route-planner-title" onSubmit={submit}>
        <div className="cockpit-route-planner__head"><div><small>Direcciones y negocios reales</small><h2 id="route-planner-title">Elegir recorrido</h2></div><button type="button" className="cockpit-icon-button" onClick={onClose} disabled={loading} aria-label="Cerrar">×</button></div>
        <LocationSearch label="Origen" value={from} selected={fromLocation} onChange={(value) => { setFrom(value); setFromLocation(null) }} onSelect={(location) => { setFrom(location.label); setFromLocation(location) }} />
        <button className="cockpit-route-planner__gps" type="button" onClick={() => { setFrom('Ubicación actual'); setFromLocation(null) }}>⌖ Usar mi ubicación actual</button>
        <button className="cockpit-route-planner__swap" type="button" aria-label="Intercambiar origen y destino" onClick={() => { const oldFrom = from; const oldFromLocation = fromLocation; setFrom(to); setFromLocation(toLocation); setTo(oldFrom); setToLocation(oldFromLocation) }}>⇅ Intercambiar</button>
        <LocationSearch label="Destino" value={to} selected={toLocation} onChange={(value) => { setTo(value); setToLocation(null) }} onSelect={(location) => { setTo(location.label); setToLocation(location) }} />
        <div className="cockpit-route-planner__presets">{LOCATIONS.slice(2, 7).map((location) => <button type="button" key={location.label} onClick={() => { setTo(location.label); setToLocation(location) }}>{location.label}</button>)}</div>
        {error && <p className="cockpit-route-planner__error" role="alert">{error}</p>}
        <button className="cockpit-button" type="submit" disabled={loading}>{loading ? 'Calculando por carretera…' : 'Usar esta ruta'}</button>
        <p className="cockpit-route-planner__source">Búsqueda: OpenStreetMap · Ruta: OSRM</p>
      </form>
    </div>
  )
}
