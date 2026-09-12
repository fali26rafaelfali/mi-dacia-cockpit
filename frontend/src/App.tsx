import { useEffect, useRef, useState } from 'react'
import { Speedometer, Tachometer } from './components/Gauges'
import { Header, QuickActions, SideMenu, Tabs, ToolDialog } from './components/Navigation'
import type { SideMenuSection } from './components/Navigation'
import { DriveHud, EnginePanel, StatusStrip, TripPanel, VehicleStatus } from './components/Panels'
import type { CockpitTab } from './components/cockpit.types'
import { RoutePlanner, type DemoLocation } from './components/RoutePlanner'
import { CockpitMap } from './features/map/CockpitMap'
import { LA_LINEA, SAN_ROQUE } from './features/demo/constants'
import { createFallbackRoute, fetchDemoRoute } from './features/map/route'
import { useDemoDrive } from './features/map/useDemoDrive'
import { useRealDrive } from './features/map/useRealDrive'
import { getGuidancePresentation, getNavigationInstruction } from './features/map/navigation'
import { useSpeech } from './hooks/useSpeech'
import './App.css'

function App() {
  const [route, setRoute] = useState(() => createFallbackRoute())
  const [routeReady, setRouteReady] = useState(false)
  const [routeLabels, setRouteLabels] = useState({ from: 'La Línea', to: 'San Roque' })
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false)
  const [driveMode, setDriveMode] = useState<'demo' | 'real'>('demo')
  const demo = useDemoDrive({ route, autoPlay: false })
  const real = useRealDrive({ route, enabled: driveMode === 'real' })
  const drive = driveMode === 'demo' ? demo : real
  const [tab, setTab] = useState<CockpitTab>('drive')
  const [menuOpen, setMenuOpen] = useState(false)
  const [tool, setTool] = useState<{ title: string; text: string } | null>(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('cockpit_theme') ?? 'dark')
  const [wakeWanted, setWakeWanted] = useState(() => localStorage.getItem('cockpit_wake') !== '0')
  const [hudMode, setHudMode] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const routeRequestRef = useRef<AbortController | null>(null)
  const maxSpeedRef = useRef(0)
  const spokenManeuversRef = useRef(new Set<string>())
  const [clock, setClock] = useState(() => new Date())
  const { speak } = useSpeech('es-ES')

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    routeRequestRef.current = controller
    void fetchDemoRoute(LA_LINEA, SAN_ROQUE, controller.signal)
      .then((roadRoute) => setRoute(roadRoute))
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setRouteReady(true)
        if (routeRequestRef.current === controller) routeRequestRef.current = null
      })
    return () => controller.abort()
  }, [])

  const speed = drive.telemetry.speedKph
  const rpm = driveMode === 'demo' && speed ? 850 + speed * 31 : 0
  maxSpeedRef.current = Math.max(maxSpeedRef.current, speed)
  const remainingKm = Math.max(0, (route.distanceM - drive.telemetry.distanceM) / 1000)
  const durationMinutes = Math.max(0, Math.round(drive.telemetry.elapsedS / 60))
  const tripKm = drive.telemetry.distanceM / 1000
  const averageKmh = drive.telemetry.elapsedS > 1 ? tripKm / (drive.telemetry.elapsedS / 3600) : 0
  const averageConsumption = 6.2
  const consumedLiters = tripKm * averageConsumption / 100
  const fuelPercent = Math.max(0, 72 - consumedLiters / 50 * 100)
  const coolantC = Math.round(Math.min(89, 62 + drive.telemetry.elapsedS * .18))
  const oilC = Math.round(Math.min(94, 58 + drive.telemetry.elapsedS * .2))
  const engineLoad = speed ? Math.min(88, 24 + speed * .48) : 0
  const throttle = speed ? Math.min(72, 12 + speed * .34) : 0
  const instantConsumption = speed ? 4.8 + engineLoad * .035 : 0
  const ecoScore = Math.max(55, 100 - Math.max(0, speed - 90) * .45 - throttle * .08)
  const estimatedGear = speed < 2 ? 'N' : speed < 18 ? '1ª' : speed < 32 ? '2ª' : speed < 48 ? '3ª' : speed < 68 ? '4ª' : speed < 88 ? '5ª' : '6ª'
  const navigation = getNavigationInstruction(route, drive.telemetry.distanceM, routeLabels.to)
  const guidance = getGuidancePresentation(navigation, drive.telemetry.roadName, routeLabels.to)
  const remainingSeconds = route.durationS * remainingKm * 1000 / Math.max(1, route.distanceM)
  const arrivalTime = new Date(clock.getTime() + remainingSeconds * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    spokenManeuversRef.current.clear()
  }, [route])

  useEffect(() => {
    if (!drive.telemetry.isPlaying || !navigation.maneuver) return
    const maneuverId = `${Math.round(navigation.maneuver.distanceM)}-${navigation.maneuver.type}`
    const speakOnce = (stage: string, message: string) => {
      const key = `${maneuverId}-${stage}`
      if (spokenManeuversRef.current.has(key)) return
      spokenManeuversRef.current.add(key)
      speak(message)
    }
    const instruction = navigation.instruction.charAt(0).toLowerCase() + navigation.instruction.slice(1)
    if (navigation.distanceM <= 25) speakOnce('ahora', `Ahora, ${instruction}`)
    else if (navigation.distanceM <= 115) speakOnce('cerca', `Dentro de 100 metros, ${instruction}`)
    else speakOnce('recto', `Continúa recto durante ${navigation.distanceLabel}${drive.telemetry.roadName ? ` por ${drive.telemetry.roadName}` : ''}`)
  }, [drive.telemetry.isPlaying, drive.telemetry.roadName, navigation.distanceLabel, navigation.distanceM, navigation.instruction, navigation.maneuver, speak])
  const resetTrip = () => {
    maxSpeedRef.current = 0
    drive.reset()
  }
  const chooseDemoRoute = async (from: DemoLocation, to: DemoLocation) => {
    routeRequestRef.current?.abort()
    const controller = new AbortController()
    routeRequestRef.current = controller
    demo.reset()
    real.reset()
    setRouteReady(false)
    try {
      const nextRoute = await fetchDemoRoute(from.coordinate, to.coordinate, controller.signal)
      if (driveMode === 'real') real.play()
      setRoute(nextRoute)
      setRouteLabels({ from: from.label, to: to.label })
      setRoutePlannerOpen(false)
    } finally {
      if (routeRequestRef.current === controller) {
        routeRequestRef.current = null
        setRouteReady(true)
      }
    }
  }

  const showTool = (title: string, text: string) => setTool({ title, text })
  const obdTool = (title: string) => showTool(title, 'Conecta un adaptador Bluetooth OBD al vehículo para consultar datos reales. La demostración no crea códigos, VIN ni estados de avería inventados.')
  const download = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const exportBackup = () => {
    const data: Record<string, string> = {}
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('cockpit_')) data[key] = localStorage.getItem(key) ?? ''
    }
    download(`cockpit-backup-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json')
    showTool('Copia de seguridad', 'Copia descargada. Incluye los ajustes y datos guardados en esta tablet.')
  }
  const downloadGpx = () => {
    const points = route.points.filter((point) => point.distanceM <= drive.telemetry.distanceM)
    if (points.length < 2) {
      showTool('Descargar ruta', 'Inicia la demostración para registrar puntos antes de descargar la ruta.')
      return
    }
    const track = points.map((point) => `<trkpt lat="${point.coordinate[1]}" lon="${point.coordinate[0]}"/>`).join('')
    download(`ruta-dacia-${Date.now()}.gpx`, `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Mi Dacia"><trk><name>Recorrido Mi Dacia</name><trkseg>${track}</trkseg></trk></gpx>`, 'application/gpx+xml')
    showTool('Descargar ruta', 'Ruta GPX descargada correctamente.')
  }
  const cycleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
    setTheme(next)
    localStorage.setItem('cockpit_theme', next)
  }
  const toggleWakeLock = async () => {
    const next = !wakeWanted
    setWakeWanted(next)
    localStorage.setItem('cockpit_wake', next ? '1' : '0')
    if (next && 'wakeLock' in navigator) {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch { showTool('Pantalla encendida', 'El navegador no permitió mantener la pantalla encendida.') }
    } else if (wakeLockRef.current) {
      await wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { showTool('Pantalla completa', 'Este navegador no permitió activar la pantalla completa.') }
  }
  const saveParking = () => {
    const [longitude, latitude] = drive.telemetry.coordinate
    localStorage.setItem('cockpit_parking', JSON.stringify({ id: `parking-${Date.now()}`, parkedAt: Date.now(), location: { latitude, longitude, timestamp: Date.now() } }))
    showTool('¿Dónde aparqué?', `Posición guardada: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`)
  }
  const themeLabel = theme === 'dark' ? 'Oscuro' : theme === 'light' ? 'Claro' : 'Automático'
  const menuSections: SideMenuSection[] = [
    { id: 'faults', label: 'Averías', items: [
      { id: 'dtc', label: 'Ver averías', subtitle: 'Códigos de fallo guardados', icon: '⚠', onSelect: () => obdTool('Ver averías') },
      { id: 'dtc-list', label: 'Lista de averías', subtitle: 'Buscar qué significa un código', icon: '⌕', onSelect: () => obdTool('Lista de averías') },
      { id: 'mil', label: 'Estado del testigo', subtitle: 'Luz del motor', icon: '◉', onSelect: () => obdTool('Estado del testigo') },
      { id: 'itv', label: 'Check pre-ITV', subtitle: 'Comprobación mediante OBD', icon: '✓', onSelect: () => obdTool('Check pre-ITV') },
      { id: 'pending', label: 'Códigos pendientes', subtitle: 'Fallos en proceso y permanentes', icon: '◷', onSelect: () => obdTool('Códigos pendientes') },
      { id: 'freeze', label: 'Datos congelados', subtitle: 'Sensores en el momento del fallo', icon: '❄', onSelect: () => obdTool('Datos congelados') },
      { id: 'clear', label: 'Borrar averías', subtitle: 'Requiere conexión y confirmación', icon: '⌫', danger: true, onSelect: () => obdTool('Borrar averías') },
      { id: 'vin', label: 'Ver VIN', subtitle: 'Número de bastidor', icon: '#', onSelect: () => obdTool('Ver VIN') },
      { id: 'diag', label: 'Diagnóstico de datos', subtitle: 'Datos disponibles del vehículo', icon: '⌁', onSelect: () => { setTab('engine'); showTool('Diagnóstico', 'Panel del motor abierto. Conecta OBD para sustituir la demostración por datos reales.') } },
    ] },
    { id: 'journey', label: 'Viaje y mapa', items: [
      { id: 'route-demo', label: 'Elegir ruta demo', subtitle: `${routeLabels.from} → ${routeLabels.to}`, icon: '↗', onSelect: () => setRoutePlannerOpen(true) },
      { id: 'history', label: 'Historial de viajes', subtitle: 'Trayectos guardados y total', icon: '↶', onSelect: () => setTab('trip') },
      { id: 'radars', label: 'Radares', subtitle: 'Avisos mediante GPS', icon: '⌖', onSelect: () => showTool('Radares', 'El servicio de radares está preparado para conectarse al bloque de navegación.') },
      { id: 'parking', label: '¿Dónde aparqué?', subtitle: 'Guardar la posición del coche', icon: 'P', onSelect: saveParking },
      { id: 'prices', label: 'Precios de gasolineras', subtitle: 'Combustibles cercanos', icon: '⛽', onSelect: () => showTool('Precios de gasolineras', 'El servicio de precios queda identificado para conectarlo al servidor FastAPI.') },
      { id: 'refuels', label: 'Repostajes', subtitle: 'Consumo y gasto mensual', icon: '◒', onSelect: () => showTool('Repostajes', 'No hay repostajes guardados todavía.') },
      { id: 'gpx', label: 'Grabar ruta', subtitle: 'Registro del recorrido actual', icon: '●', state: drive.telemetry.isPlaying ? 'Grabando' : 'Parada', onSelect: () => showTool('Grabar ruta', drive.telemetry.isPlaying ? 'El recorrido actual se está registrando.' : `Inicia el modo ${driveMode === 'demo' ? 'demo' : 'GPS real'} para comenzar el registro.`) },
      { id: 'gpx-download', label: 'Descargar ruta GPX', subtitle: 'Abrir en otro navegador GPS', icon: '↓', onSelect: downloadGpx },
    ] },
    { id: 'screen', label: 'Pantalla y sistema', items: [
      { id: 'fullscreen', label: 'Pantalla completa', subtitle: 'Ocultar las barras del navegador', icon: '⛶', onSelect: () => { void toggleFullscreen() } },
      { id: 'theme', label: 'Tema', subtitle: 'Claro, oscuro o automático', icon: '☼', state: themeLabel, onSelect: cycleTheme },
      { id: 'wake', label: 'Pantalla siempre encendida', subtitle: 'Evitar el bloqueo de la tablet', icon: '◐', state: wakeWanted ? 'Activada' : 'Desactivada', onSelect: () => { void toggleWakeLock() } },
      { id: 'settings', label: 'Ajustes', subtitle: 'Unidades, voz y límites', icon: '⚙', onSelect: () => showTool('Ajustes', `Tema: ${themeLabel}. Pantalla encendida: ${wakeWanted ? 'sí' : 'no'}. Los ajustes permanecen guardados en esta tablet.`) },
      { id: 'backup', label: 'Copia de seguridad', subtitle: 'Exportar los datos de la tablet', icon: '⇧', onSelect: exportBackup },
      { id: 'hud', label: 'Modo HUD', subtitle: 'Reflejar en el parabrisas', icon: '◇', state: hudMode ? 'Activado' : 'Normal', onSelect: () => setHudMode((active) => !active) },
      { id: 'sos', label: 'Emergencia (SOS)', subtitle: 'Mostrar ayuda y posición', icon: 'SOS', danger: true, onSelect: () => showTool('Emergencia 112', `Ubicación actual: ${drive.telemetry.coordinate[1].toFixed(5)}, ${drive.telemetry.coordinate[0].toFixed(5)}. En una emergencia real llama al 112.`) },
    ] },
  ]

  return (
    <main className={hudMode ? 'cockpit-shell cockpit-shell--hud' : 'cockpit-shell'} data-theme={theme}>
      <Header time={clock} title="MI DACIA" profileName="Sandero Stepway" onMenuClick={() => setMenuOpen(true)} />
      <section className="cockpit-main">
        <aside className="cockpit-left-rail">
          <div className="cockpit-drive-mode" role="group" aria-label="Modo de conducción">
            <button className={driveMode === 'demo' ? 'is-active' : ''} type="button" onClick={() => setDriveMode('demo')}>DEMO</button>
            <button className={driveMode === 'real' ? 'is-active' : ''} type="button" onClick={() => setDriveMode('real')}>REAL GPS</button>
          </div>
          <div className="cockpit-mode"><span className={drive.telemetry.isPlaying && (!('hasFix' in drive) || drive.hasFix) ? 'cockpit-live-dot' : ''} />{
            driveMode === 'demo'
              ? drive.telemetry.isPlaying ? 'DEMO EN VIVO' : 'DEMO LISTO'
              : real.error ? 'GPS SIN CONEXIÓN' : real.hasFix ? `GPS REAL · ±${Math.round(real.accuracyM ?? 0)} M` : 'BUSCANDO GPS…'
          }</div>
          {driveMode === 'real' && real.error && <p className="cockpit-gps-error">{real.error}</p>}
          {driveMode === 'real' && real.offRoute && <p className="cockpit-gps-warning">Fuera de la ruta calculada</p>}
          <Speedometer speed={speed} speedLimit={route.points.find((point) => point.distanceM >= drive.telemetry.distanceM)?.speedLimitKph ?? 50} size={230} />
          <Tachometer rpm={rpm} size={188} />
          <button className="cockpit-route-select-button" type="button" onClick={() => setRoutePlannerOpen(true)}>↗ {routeLabels.from} → {routeLabels.to}</button>
          <button className="cockpit-demo-button" type="button" disabled={!routeReady} onClick={drive.telemetry.isPlaying ? drive.pause : drive.play}>
            {!routeReady ? 'Calculando ruta…' : driveMode === 'real' ? drive.telemetry.isPlaying ? 'Pausar GPS' : 'Iniciar GPS real' : drive.telemetry.isPlaying ? 'Pausar demo' : drive.telemetry.progress > 0 ? 'Continuar demo' : 'Probar demo'}
          </button>
          <button className="cockpit-reset-button" type="button" onClick={drive.reset}>Reiniciar recorrido</button>
        </aside>
        <section className="cockpit-center-stage">
          <CockpitMap route={route} telemetry={drive.telemetry} liveTelemetry={drive.liveTelemetry} fromLabel={driveMode === 'real' ? 'Ubicación actual' : routeLabels.from} toLabel={routeLabels.to} />
          <DriveHud instruction={guidance.instruction} distanceLabel={navigation.distanceLabel} arrow={guidance.arrow} roadName={guidance.roadName} destination={routeLabels.to} arrivalTime={arrivalTime} remainingKm={Number(remainingKm.toFixed(1))} heading={`${Math.round(drive.telemetry.bearingDeg)}°`} />
        </section>
        <aside className="cockpit-right-rail">
          <Tabs activeTab={tab} onChange={setTab} />
          <div className="cockpit-tab-content" id={`cockpit-panel-${tab}`} role="tabpanel" aria-labelledby={`cockpit-tab-${tab}`}>
            {tab === 'drive' && <VehicleStatus dataMode={driveMode} fuelPercent={fuelPercent} rangeKm={Math.round(fuelPercent / 100 * 675)} batteryVoltage={speed ? 14.2 : 12.6} speedKmh={speed} rpm={rpm} coolantC={coolantC} tripKm={tripKm} />}
            {tab === 'trip' && <TripPanel dataMode={driveMode} onReset={resetTrip} trip={{ distanceKm: tripKm, durationMinutes, durationSeconds: drive.telemetry.elapsedS, averageKmh: Math.round(averageKmh), maxSpeedKmh: maxSpeedRef.current, consumptionL100Km: driveMode === 'demo' ? averageConsumption : 0, consumedLiters: driveMode === 'demo' ? consumedLiters : 0, costEuro: driveMode === 'demo' ? consumedLiters * 1.72 : 0, gear: driveMode === 'demo' ? estimatedGear : '–', headingDeg: drive.telemetry.bearingDeg, altitudeM: driveMode === 'real' ? real.altitudeM ?? undefined : undefined, ecoScore: driveMode === 'demo' ? ecoScore : undefined }} />}
            {tab === 'engine' && <EnginePanel dataMode={driveMode} coolantC={coolantC} oilC={oilC} instantConsumption={instantConsumption} averageConsumption={averageConsumption} ecoScore={ecoScore} rpm={rpm} speedKmh={speed} batteryVoltage={speed ? 14.2 : 12.6} engineLoadPercent={engineLoad} throttlePercent={throttle} intakeC={21} fuelPercent={fuelPercent} runtimeSeconds={drive.telemetry.elapsedS} onConnect={() => obdTool('Conectar OBD')} />}
          </div>
          <StatusStrip items={[{ id: 'gps', label: 'GPS', value: driveMode === 'demo' ? 'Demo' : real.hasFix ? `±${Math.round(real.accuracyM ?? 0)} m` : 'Buscando', icon: '⌖' }, { id: 'range', label: 'Autonomía', value: driveMode === 'demo' ? '486 km' : 'Sin OBD', icon: '◒' }, { id: 'outside', label: 'Exterior', value: '21 °C', icon: '☀' }]} />
          <QuickActions actions={[{ id: 'route', label: 'Ruta', icon: '↗', active: true, onClick: () => setRoutePlannerOpen(true) }, { id: 'fuel', label: 'Combustible', icon: '◒', onClick: () => setTab('drive') }, { id: 'parking', label: 'Aparcar', icon: 'P', onClick: () => undefined }, { id: 'radar', label: 'Radar', icon: '⌖', onClick: () => undefined }]} />
        </aside>
      </section>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} sections={menuSections} vehicleName="Sandero Stepway" />
      {routePlannerOpen && <RoutePlanner fromLabel={driveMode === 'real' ? 'Ubicación actual' : routeLabels.from} toLabel={routeLabels.to} onClose={() => setRoutePlannerOpen(false)} onApply={chooseDemoRoute} />}
      {tool && <ToolDialog title={tool.title} text={tool.text} onClose={() => setTool(null)} />}
    </main>
  )
}

export default App
