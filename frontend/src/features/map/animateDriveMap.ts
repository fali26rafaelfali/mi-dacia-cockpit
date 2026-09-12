import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Coordinate, DriveRoute, DriveTelemetry } from './types'
import { updateNextManeuver } from './Maneuvers3D'

interface VehicleMarker {
  getElement(): HTMLElement
  setLngLat(coordinate: Coordinate): void
}

// Un indicador de navegación siempre visible no necesita leer la profundidad GPU.
export function createVehicleMarker(map: MapLibreMap, node: HTMLElement, initial: Coordinate) {
  let position = initial
  node.classList.add('maplibregl-marker', 'maplibregl-marker-anchor-bottom')
  const update = () => {
    const point = map.project([...position])
    node.style.transform = `translate(-50%, -100%) translate(${point.x}px, ${point.y}px)`
  }
  map.getCanvasContainer().appendChild(node)
  map.on('move', update)
  map.on('terrain', update)
  update()
  return {
    getElement: () => node,
    setLngLat: (coordinate: Coordinate) => { position = coordinate; update() },
    remove: () => { map.off('move', update); map.off('terrain', update); node.remove() },
  }
}

export function smoothAngle(from: number, to: number, dt: number, seconds: number): number {
  return from + (((to - from + 540) % 360) - 180) * (1 - Math.exp(-dt / seconds))
}

/** Un único reloj visual para coche y cámara, independiente de los renders de React. */
export function animateDriveMap(map: MapLibreMap, marker: VehicleMarker, car: HTMLImageElement,
  route: DriveRoute, live: { current: DriveTelemetry }, reportElevation?: (meters: number) => void): () => void {
  let frame = 0
  let previousTime = performance.now()
  let lastPose: DriveTelemetry | undefined
  let lastTrailTime = -Infinity
  let lastTrailDistance = -1
  let lastElevationTime = -Infinity
  let playing = false
  let following = false
  let transitionUntil = 0
  let lastCameraTime = -Infinity
  let interactionUntil = 0
  let pointerDown = false
  let heading = live.current.bearingDeg
  let displayedCoordinate: Coordinate = [...live.current.coordinate]
  let closeView = false
  const node = marker.getElement()
  const container = map.getContainer()
  const interact = () => {
    interactionUntil = performance.now() + 1200
    following = false
  }
  const down = () => { pointerDown = true; interact() }
  const up = () => { if (pointerDown) { pointerDown = false; interact() } }
  const present = () => {
    const zoom = map.getZoom()
    // Histéresis para que pin/coche no parpadeen cerca del umbral.
    closeView = closeView ? zoom >= 17.7 : zoom >= 17.8
    node.classList.toggle('is-close', closeView)
    const scale = Math.min(2, 1 + Math.max(0, zoom - 17.8) * .3125)
    car.style.transform = `translateY(50%) rotate(${heading - map.getBearing()}deg) scale(${scale})`
  }
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    const dt = Math.min(.05, Math.max(0, (now - previousTime) / 1000))
    previousTime = now
    // La cámara y el marcador pueden empezar antes de que terminen de llegar
    // los mosaicos; esperar al evento load dejaba el demo parado en redes lentas.
    if (document.hidden) return
    const pose = live.current
    if (pose === lastPose && !pose.isPlaying) return
    const starting = pose.isPlaying && !playing
    const reset = lastPose && pose.distanceM < lastPose.distanceM
    playing = pose.isPlaying
    lastPose = pose
    heading = reset ? pose.bearingDeg : smoothAngle(heading, pose.bearingDeg, dt, .12)
    if (starting || reset) {
      displayedCoordinate = [...pose.coordinate]
    } else {
      // El GPS suele entregar una posición por segundo. Acercarse al nuevo punto
      // en varios fotogramas evita que el coche y la cámara den saltos.
      const coordinateBlend = 1 - Math.exp(-dt / .28)
      displayedCoordinate = [
        displayedCoordinate[0] + (pose.coordinate[0] - displayedCoordinate[0]) * coordinateBlend,
        displayedCoordinate[1] + (pose.coordinate[1] - displayedCoordinate[1]) * coordinateBlend,
      ]
    }

    if (pose.isPlaying && !pointerDown && now > interactionUntil) {
      const zoom = map.getZoom()
      const pitch = zoom < 17 ? 48 : zoom < 18 ? 60 : 69
      if (starting || !following) {
        following = true
        transitionUntil = now + 650
        const startingZoom = pose.roadClass === 'urban' ? 18.25 : pose.roadClass === 'road' ? 17.25 : 16.5
        map.easeTo({ center: [...displayedCoordinate], bearing: heading,
          zoom: starting ? startingZoom : zoom, pitch: starting ? 69 : pitch,
          duration: 650, essential: true })
      } else if (now >= transitionUntil && now - lastCameraTime >= 33 && !map.isMoving()) {
        // Sin animaciones solapadas ni cambios bruscos de inclinación al hacer zoom.
        map.jumpTo({ center: [...displayedCoordinate], zoom,
          bearing: smoothAngle(map.getBearing(), heading, dt, .22),
          pitch: map.getPitch() + (pitch - map.getPitch()) * (1 - Math.exp(-dt / .35)) })
        lastCameraTime = now
      }
    }
    marker.setLngLat([...displayedCoordinate])
    present()

    if (reportElevation && now - lastElevationTime >= 500) {
      const elevation = map.queryTerrainElevation([...pose.coordinate])
      if (elevation !== null && Number.isFinite(elevation)) reportElevation(elevation)
      lastElevationTime = now
    }

    // Esta geometría requiere trabajo de los workers: no reenviarla cada fotograma.
    if (pose.distanceM !== lastTrailDistance && (reset || !pose.isPlaying || now - lastTrailTime >= 250)) {
      const coordinates = route.points.filter((point) => point.distanceM <= pose.distanceM).map((point) => [...point.coordinate])
      coordinates.push([...pose.coordinate])
      if (coordinates.length < 2) coordinates.push([...pose.coordinate])
      const source = map.getSource('route-travelled') as GeoJSONSource | undefined
      source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })
      updateNextManeuver(map, route, pose.distanceM)
      lastTrailTime = now
      lastTrailDistance = pose.distanceM
    }
  }
  map.on('move', present)
  container.addEventListener('wheel', interact, { passive: true })
  container.addEventListener('pointerdown', down)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
  present()
  frame = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(frame)
    map.off('move', present)
    container.removeEventListener('wheel', interact)
    container.removeEventListener('pointerdown', down)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
}
