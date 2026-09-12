import type { DiagnosticItem, StatusItem, SystemState, TripData, VehicleAlert } from './cockpit.types'

const stateLabels: Record<SystemState, string> = {
  ok: 'Correcto',
  warning: 'Atención',
  error: 'Error',
  offline: 'Sin conexión',
}

export interface VehicleStatusProps {
  dataMode?: 'demo' | 'real'
  fuelPercent: number
  rangeKm: number
  batteryVoltage?: number
  tirePressureBar?: number[]
  alerts?: VehicleAlert[]
  speedKmh?: number
  rpm?: number
  coolantC?: number
  tripKm?: number
}

export function VehicleStatus({
  dataMode = 'demo',
  fuelPercent,
  rangeKm,
  batteryVoltage = 12.6,
  tirePressureBar = [2.3, 2.3, 2.2, 2.2],
  alerts = [],
  speedKmh = 0,
  rpm = 0,
  coolantC = 62,
  tripKm = 0,
}: VehicleStatusProps) {
  const fuel = Math.min(Math.max(fuelPercent, 0), 100)
  const engineAvailable = dataMode === 'demo'
  return (
    <section className="cockpit-card cockpit-vehicle-status" aria-labelledby="vehicle-status-title">
      <div className="cockpit-card__heading">
        <div><small>Resumen</small><h2 id="vehicle-status-title">Estado del vehículo</h2></div>
        <span className={alerts.length ? 'cockpit-badge cockpit-badge--warning' : 'cockpit-badge cockpit-badge--ok'}>
          {alerts.length ? `${alerts.length} avisos` : engineAvailable ? 'Todo correcto' : 'GPS REAL'}
        </span>
      </div>
      <div className="cockpit-fuel">
        <div className="cockpit-fuel__meta">
          <span>Combustible</span><strong>{engineAvailable ? `${Math.round(fuel)}%` : '–'}</strong>
        </div>
        <div className="cockpit-progress" role="progressbar" aria-label="Nivel de combustible" aria-valuenow={fuel} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${engineAvailable ? fuel : 0}%` }} />
        </div>
        <p><strong>{engineAvailable ? `${rangeKm} km` : 'Conecta OBD'}</strong> {engineAvailable ? 'de autonomía estimada' : 'para leer el vehículo'}</p>
      </div>
      <div className="cockpit-status-grid">
        <div><span>Batería</span><strong>{engineAvailable ? `${batteryVoltage.toFixed(1)} V` : '–'}</strong></div>
        <div><span>Neumáticos</span><strong>{engineAvailable ? `${Math.min(...tirePressureBar).toFixed(1)} bar` : '–'}</strong></div>
        <div><span>Velocidad</span><strong>{Math.round(speedKmh)} km/h</strong></div>
        <div><span>Motor</span><strong>{engineAvailable ? `${Math.round(rpm)} rpm` : '–'}</strong></div>
        <div><span>Refrigerante</span><strong>{engineAvailable ? `${Math.round(coolantC)} °C` : '–'}</strong></div>
        <div><span>Viaje</span><strong>{tripKm.toFixed(1)} km</strong></div>
      </div>
      {alerts.length > 0 && (
        <ul className="cockpit-alert-list">
          {alerts.map((alert) => (
            <li className={`cockpit-alert cockpit-alert--${alert.level}`} key={alert.id}>
              <strong>{alert.title}</strong>{alert.description && <span>{alert.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export interface DriveHudProps {
  roadName?: string
  instruction?: string
  distanceLabel?: string
  arrow?: string
  destination?: string
  distanceToTurnKm?: number
  arrivalTime?: string
  remainingKm?: number
  heading?: string
}

export function DriveHud({
  roadName = 'A-6 · Autovía del Noroeste',
  instruction,
  distanceLabel,
  arrow = '↗',
  destination = 'Destino',
  distanceToTurnKm = 1.2,
  arrivalTime = '18:42',
  remainingKm = 34,
  heading = 'NO',
}: DriveHudProps) {
  return (
    <section className="cockpit-drive-hud" aria-labelledby="route-title">
      <div className="cockpit-drive-hud__route">
        <span className="cockpit-route-arrow" aria-hidden="true">{arrow}</span>
        <div><small>{distanceLabel ? `En ${distanceLabel}${roadName ? ` · ${roadName}` : ''}` : `En ${distanceToTurnKm.toLocaleString('es-ES')} km`}</small><h2 id="route-title">{instruction ?? roadName}</h2></div>
        <span className="cockpit-compass">{heading}</span>
      </div>
      <div className="cockpit-drive-hud__footer">
        <span><small>Destino</small><strong>{destination}</strong></span>
        <span><small>Llegada</small><strong>{arrivalTime}</strong></span>
        <span><small>Restantes</small><strong>{remainingKm} km</strong></span>
      </div>
    </section>
  )
}

export interface TripPanelProps {
  trip: TripData
  onReset?: () => void
  dataMode?: 'demo' | 'real'
}

export function TripPanel({ trip, onReset, dataMode = 'demo' }: TripPanelProps) {
  const totalSeconds = Math.round(trip.durationSeconds ?? trip.durationMinutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return (
    <section className="cockpit-card cockpit-metric-panel">
      <div className="cockpit-card__heading"><div><small>Desde la salida · {dataMode === 'demo' ? 'DEMO' : 'GPS REAL'}</small><h2>Viaje actual</h2></div>{onReset && <button className="cockpit-panel-reset" type="button" onClick={onReset}>Reiniciar</button>}</div>
      <div className="cockpit-metrics">
        <div><strong>{trip.distanceKm.toFixed(1)}</strong><span>km recorridos</span></div>
        <div><strong>{hours ? `${hours}h ` : ''}{minutes}m {String(seconds).padStart(2, '0')}s</strong><span>duración</span></div>
        <div><strong>{trip.averageKmh}</strong><span>km/h media</span></div>
        <div><strong>{Math.round(trip.maxSpeedKmh ?? 0)}</strong><span>km/h máxima</span></div>
        <div><strong>{dataMode === 'demo' ? trip.consumptionL100Km.toFixed(1) : '–'}</strong><span>l/100 km</span></div>
        <div><strong>{dataMode === 'demo' ? `${(trip.costEuro ?? 0).toFixed(2)} €` : '–'}</strong><span>coste estimado</span></div>
      </div>
      <h3 className="cockpit-panel-subtitle">Rendimiento</h3>
      <div className="cockpit-metrics cockpit-metrics--compact">
        <div><strong>{trip.gear ?? '–'}</strong><span>marcha estimada</span></div>
        <div><strong>{trip.headingDeg === undefined ? '–' : `${Math.round(trip.headingDeg)}°`}</strong><span>rumbo GPS</span></div>
        <div><strong>{trip.altitudeM === undefined ? '–' : Math.round(trip.altitudeM)}</strong><span>altitud m</span></div>
        <div><strong>{trip.gradePercent === undefined ? '–' : trip.gradePercent.toFixed(1)}</strong><span>pendiente %</span></div>
      </div>
      <div className="cockpit-eco-row"><span>Conducción eco</span><strong>{dataMode === 'demo' ? `${Math.round(trip.ecoScore ?? 100)}/100` : 'Requiere OBD'}</strong></div>
    </section>
  )
}

export interface EnginePanelProps {
  dataMode?: 'demo' | 'real'
  coolantC?: number
  oilC?: number
  instantConsumption?: number
  ecoScore?: number
  rpm?: number
  speedKmh?: number
  batteryVoltage?: number
  engineLoadPercent?: number
  throttlePercent?: number
  intakeC?: number
  fuelPercent?: number
  averageConsumption?: number
  runtimeSeconds?: number
  onConnect?: () => void
}

export function EnginePanel({ dataMode = 'demo', coolantC = 62, oilC = 58, instantConsumption = 0, ecoScore = 100, rpm = 0, speedKmh = 0, batteryVoltage = 12.6, engineLoadPercent = 0, throttlePercent = 0, intakeC = 21, fuelPercent = 72, averageConsumption = 6.2, runtimeSeconds = 0, onConnect }: EnginePanelProps) {
  const value = (demoValue: string | number) => dataMode === 'demo' ? demoValue : '–'
  return (
    <section className="cockpit-card cockpit-metric-panel">
      <div className="cockpit-card__heading"><div><small>{dataMode === 'demo' ? 'Telemetría simulada' : 'GPS real · motor sin OBD'}</small><h2>Motor</h2></div><span className="cockpit-badge cockpit-badge--demo">{dataMode === 'demo' ? 'DEMO' : 'GPS'}</span></div>
      <div className="cockpit-metrics">
        <div><strong>{value(Math.round(rpm))}</strong><span>rpm</span></div>
        <div><strong>{Math.round(speedKmh)}</strong><span>km/h</span></div>
        <div><strong>{value(`${coolantC}°`)}</strong><span>refrigerante</span></div>
        <div><strong>{value(`${oilC}°`)}</strong><span>aceite</span></div>
        <div><strong>{value(instantConsumption.toFixed(1))}</strong><span>l/100 km ahora</span></div>
        <div><strong>{value(averageConsumption.toFixed(1))}</strong><span>l/100 km media</span></div>
      </div>
      <h3 className="cockpit-panel-subtitle">Carga y alimentación</h3>
      <div className="cockpit-metrics cockpit-metrics--compact">
        <div><strong>{value(`${Math.round(engineLoadPercent)}%`)}</strong><span>carga motor</span></div>
        <div><strong>{value(`${Math.round(throttlePercent)}%`)}</strong><span>acelerador</span></div>
        <div><strong>{value(`${intakeC}°`)}</strong><span>aire admisión</span></div>
        <div><strong>{value(`${batteryVoltage.toFixed(1)} V`)}</strong><span>batería</span></div>
        <div><strong>{value(`${Math.round(fuelPercent)}%`)}</strong><span>combustible</span></div>
        <div><strong>{value(`${Math.floor(runtimeSeconds / 60)}m`)}</strong><span>motor activo</span></div>
      </div>
      <div className="cockpit-eco-row"><span>Puntuación eco</span><strong>{value(`${Math.round(ecoScore)}/100`)}</strong></div>
      {onConnect && <button className="cockpit-button cockpit-button--secondary" type="button" onClick={onConnect}>Conectar OBD para datos reales</button>}
    </section>
  )
}

export interface DiagnosticsPanelProps {
  items: DiagnosticItem[]
  lastCheck?: string
  onRunDiagnostics?: () => void
}

export function DiagnosticsPanel({ items, lastCheck = 'Ahora', onRunDiagnostics }: DiagnosticsPanelProps) {
  const healthy = items.filter((item) => item.state === 'ok').length
  return (
    <section className="cockpit-card cockpit-diagnostics" aria-labelledby="diagnostics-title">
      <div className="cockpit-card__heading">
        <div><small>Última comprobación: {lastCheck}</small><h2 id="diagnostics-title">Diagnóstico</h2></div>
        <span className="cockpit-badge cockpit-badge--ok">{healthy}/{items.length} sistemas</span>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span className={`cockpit-state cockpit-state--${item.state}`} aria-hidden="true" />
            <div><strong>{item.label}</strong><span>{item.detail}</span></div>
            <small>{stateLabels[item.state]}</small>
          </li>
        ))}
      </ul>
      {onRunDiagnostics && <button type="button" className="cockpit-button cockpit-button--secondary" onClick={onRunDiagnostics}>Ejecutar diagnóstico</button>}
    </section>
  )
}

export interface StatusStripProps {
  items: StatusItem[]
}

export function StatusStrip({ items }: StatusStripProps) {
  return (
    <div className="cockpit-status-strip" aria-label="Indicadores rápidos">
      {items.map((item) => (
        <div key={item.id}>
          {item.icon && <span aria-hidden="true">{item.icon}</span>}
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}
