import type { DiagnosticItem, StatusItem, SystemState, TripData, VehicleAlert } from './cockpit.types'
import type { RouteLane } from '../features/map/types'

const stateLabels: Record<SystemState, string> = {
  ok: 'Correcto',
  warning: 'Atención',
  error: 'Error',
  offline: 'Sin conexión',
}

export interface VehicleStatusProps {
  dataMode?: 'demo' | 'gps' | 'obd'
  fuelPercent?: number
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
  batteryVoltage,
  tirePressureBar = [2.3, 2.3, 2.2, 2.2],
  alerts = [],
  speedKmh = 0,
  rpm,
  coolantC,
  tripKm = 0,
}: VehicleStatusProps) {
  const fuel = fuelPercent === undefined ? 0 : Math.min(Math.max(fuelPercent, 0), 100)
  const engineAvailable = dataMode !== 'gps'
  const show = (number: number | undefined, unit: string, decimals = 0) => engineAvailable && number !== undefined ? `${number.toFixed(decimals)} ${unit}` : '–'
  return (
    <section className="cockpit-card cockpit-vehicle-status" aria-labelledby="vehicle-status-title">
      <div className="cockpit-card__heading">
        <div><small>Resumen</small><h2 id="vehicle-status-title">Estado del vehículo</h2></div>
        <span className={alerts.length ? 'cockpit-badge cockpit-badge--warning' : 'cockpit-badge cockpit-badge--ok'}>
          {alerts.length ? `${alerts.length} avisos` : dataMode === 'obd' ? 'OBD REAL' : engineAvailable ? 'Todo correcto' : 'GPS REAL'}
        </span>
      </div>
      <div className="cockpit-fuel">
        <div className="cockpit-fuel__meta">
          <span>Combustible</span><strong>{engineAvailable && fuelPercent !== undefined ? `${Math.round(fuel)}%` : '–'}</strong>
        </div>
        <div className="cockpit-progress" role="progressbar" aria-label="Nivel de combustible" aria-valuenow={fuel} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${engineAvailable && fuelPercent !== undefined ? fuel : 0}%` }} />
        </div>
        <p><strong>{engineAvailable && fuelPercent !== undefined ? `${rangeKm} km` : 'Sin lectura'}</strong> {engineAvailable && fuelPercent !== undefined ? 'de autonomía estimada' : 'de combustible por OBD'}</p>
      </div>
      <div className="cockpit-status-grid">
        <div><span>Batería</span><strong>{show(batteryVoltage, 'V', 1)}</strong></div>
        <div><span>Neumáticos</span><strong>{dataMode === 'demo' ? `${Math.min(...tirePressureBar).toFixed(1)} bar` : '–'}</strong></div>
        <div><span>Velocidad</span><strong>{Math.round(speedKmh)} km/h</strong></div>
        <div><span>Motor</span><strong>{show(rpm, 'rpm')}</strong></div>
        <div><span>Refrigerante</span><strong>{show(coolantC, '°C')}</strong></div>
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
  lanes?: RouteLane[]
}

const laneArrow = (indications: string[]) => {
  const value = indications.join(' ')
  if (value.includes('uturn')) return '↶'
  if (value.includes('left')) return value.includes('slight') ? '↖' : '←'
  if (value.includes('right')) return value.includes('slight') ? '↗' : '→'
  return '↑'
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
  lanes = [],
}: DriveHudProps) {
  return (
    <section className="cockpit-drive-hud" aria-labelledby="route-title">
      <div className="cockpit-drive-hud__route">
        <span className="cockpit-route-arrow" aria-hidden="true">{arrow}</span>
        <div><small>{distanceLabel ? `En ${distanceLabel}${roadName ? ` · ${roadName}` : ''}` : `En ${distanceToTurnKm.toLocaleString('es-ES')} km`}</small><h2 id="route-title">{instruction ?? roadName}</h2></div>
        <span className="cockpit-compass">{heading}</span>
      </div>
      {lanes.length > 0 && <div className="cockpit-lanes" aria-label="Carriles recomendados">
        <small>CARRILES</small>
        <div>{lanes.map((lane, index) => <span className={lane.valid ? 'is-valid' : ''} key={`${lane.indications.join('-')}-${index}`}>{laneArrow(lane.indications)}</span>)}</div>
      </div>}
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
  dataMode?: 'demo' | 'gps' | 'obd'
}

export function TripPanel({ trip, onReset, dataMode = 'demo' }: TripPanelProps) {
  const totalSeconds = Math.round(trip.durationSeconds ?? trip.durationMinutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return (
    <section className="cockpit-card cockpit-metric-panel">
      <div className="cockpit-card__heading"><div><small>Desde la salida · {dataMode === 'demo' ? 'DEMO' : dataMode === 'obd' ? 'GPS + OBD REAL' : 'GPS REAL'}</small><h2>Viaje actual</h2></div>{onReset && <button className="cockpit-panel-reset" type="button" onClick={onReset}>Reiniciar</button>}</div>
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
  dataMode?: 'demo' | 'gps' | 'obd'
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
  connectLabel?: string
  obdError?: string | null
}

export function EnginePanel({ dataMode = 'demo', coolantC, oilC, instantConsumption, ecoScore, rpm, speedKmh = 0, batteryVoltage, engineLoadPercent, throttlePercent, intakeC, fuelPercent, averageConsumption, runtimeSeconds, onConnect, connectLabel = 'Conectar OBD para datos reales', obdError }: EnginePanelProps) {
  const value = (number: number | undefined, suffix = '', decimals = 0) => dataMode !== 'gps' && number !== undefined ? `${number.toFixed(decimals)}${suffix}` : '–'
  return (
    <section className="cockpit-card cockpit-metric-panel">
      <div className="cockpit-card__heading"><div><small>{dataMode === 'demo' ? 'Telemetría simulada' : dataMode === 'obd' ? 'Telemetría Bluetooth del vehículo' : 'GPS real · motor sin OBD'}</small><h2>Motor</h2></div><span className="cockpit-badge cockpit-badge--demo">{dataMode === 'demo' ? 'DEMO' : dataMode === 'obd' ? 'OBD REAL' : 'GPS'}</span></div>
      <div className="cockpit-metrics">
        <div><strong>{value(rpm)}</strong><span>rpm</span></div>
        <div><strong>{Math.round(speedKmh)}</strong><span>km/h</span></div>
        <div><strong>{value(coolantC, '°')}</strong><span>refrigerante</span></div>
        <div><strong>{value(oilC, '°')}</strong><span>aceite</span></div>
        <div><strong>{value(instantConsumption, '', 1)}</strong><span>l/100 km ahora</span></div>
        <div><strong>{value(averageConsumption, '', 1)}</strong><span>l/100 km media</span></div>
      </div>
      <h3 className="cockpit-panel-subtitle">Carga y alimentación</h3>
      <div className="cockpit-metrics cockpit-metrics--compact">
        <div><strong>{value(engineLoadPercent, '%')}</strong><span>carga motor</span></div>
        <div><strong>{value(throttlePercent, '%')}</strong><span>acelerador</span></div>
        <div><strong>{value(intakeC, '°')}</strong><span>aire admisión</span></div>
        <div><strong>{value(batteryVoltage, ' V', 1)}</strong><span>batería</span></div>
        <div><strong>{value(fuelPercent, '%')}</strong><span>combustible</span></div>
        <div><strong>{value(runtimeSeconds === undefined ? undefined : runtimeSeconds / 60, 'm')}</strong><span>motor activo</span></div>
      </div>
      <div className="cockpit-eco-row"><span>Puntuación eco</span><strong>{value(ecoScore, '/100')}</strong></div>
      {obdError && <p className="cockpit-gps-error">{obdError}</p>}
      {onConnect && <button className="cockpit-button cockpit-button--secondary" type="button" onClick={onConnect}>{connectLabel}</button>}
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
