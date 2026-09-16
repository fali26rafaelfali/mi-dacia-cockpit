import { formatNavigationDistance } from '../features/map/navigation'
import type { FoodStop } from '../features/map/routePlaces'

const kindLabel: Record<FoodStop['kind'], string> = {
  restaurant: 'Restaurante',
  cafe: 'Cafetería',
  fast_food: 'Comida rápida',
}

export function FoodStopsDialog({ stops, currentDistanceM, loading, error, onClose }: {
  stops: FoodStop[]
  currentDistanceM: number
  loading: boolean
  error: string
  onClose: () => void
}) {
  return <div className="cockpit-dialog-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="cockpit-dialog cockpit-food-dialog" role="dialog" aria-modal="true" aria-labelledby="food-stops-title">
      <div className="cockpit-food-dialog__head"><div><small>Paradas próximas al recorrido</small><h2 id="food-stops-title">Comer en ruta</h2></div><button className="cockpit-icon-button" type="button" onClick={onClose} aria-label="Cerrar">×</button></div>
      <p className="cockpit-food-dialog__intro">Restaurantes y cafeterías a ambos lados del recorrido pendiente, hasta tu destino, a un máximo de 1,2 kilómetros en línea recta de la ruta.</p>
      {loading && <p>Buscando restaurantes cercanos al trayecto…</p>}
      {!loading && error && <p className="cockpit-gps-error">{error}</p>}
      {!loading && !error && stops.length === 0 && <p>No hay restaurantes con nombre registrados cerca del tramo que queda.</p>}
      <div className="cockpit-food-list">{stops.map((stop) => {
        const aheadM = Math.max(0, stop.routeDistanceM - currentDistanceM)
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${stop.coordinate[1]},${stop.coordinate[0]}`
        return <article key={stop.id}>
          <div><strong>{stop.name}</strong><small>{kindLabel[stop.kind]}{stop.cuisine ? ` · ${stop.cuisine.replaceAll(';', ', ').replaceAll('_', ' ')}` : ''}</small></div>
          <span><b>{aheadM < 100 ? 'Ahora' : `En ${formatNavigationDistance(aheadM)}`}</b><small>A {formatNavigationDistance(stop.detourM)} en línea recta de la ruta</small></span>
          {stop.openingHours && <small className="cockpit-food-list__hours">Horario OSM: {stop.openingHours}</small>}
          <a href={mapsUrl} target="_blank" rel="noreferrer">Ver ubicación</a>
        </article>
      })}</div>
      <button type="button" className="cockpit-button" onClick={onClose}>Cerrar</button>
    </section>
  </div>
}
