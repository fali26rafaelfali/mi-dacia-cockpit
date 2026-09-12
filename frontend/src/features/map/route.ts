import {
  FALLBACK_ROUTE,
  OSRM_BASE_URL,
} from '../demo/constants'
import type {
  Coordinate,
  DriveRoute,
  RoadClass,
  RouteManeuver,
  RoutePoint,
} from './types'

const EARTH_RADIUS_M = 6_371_000
const MAX_SAMPLE_GAP_M = 18

const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const toDegrees = (radians: number) => (radians * 180) / Math.PI
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

interface RoadStep {
  distanceM: number
  name: string
  type: string
  modifier: string
  exit?: number
  location?: Coordinate
  bearingAfter?: number
}

export function distanceBetween(a: Coordinate, b: Coordinate): number {
  const lat1 = toRadians(a[1])
  const lat2 = toRadians(b[1])
  const deltaLat = lat2 - lat1
  const deltaLng = toRadians(b[0] - a[0])
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function bearingBetween(a: Coordinate, b: Coordinate): number {
  const lat1 = toRadians(a[1])
  const lat2 = toRadians(b[1])
  const deltaLng = toRadians(b[0] - a[0])
  const y = Math.sin(deltaLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function shortestAngle(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

function interpolateCoordinate(
  a: Coordinate,
  b: Coordinate,
  amount: number,
): Coordinate {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
  ]
}

export function densifyRoute(
  coordinates: readonly Coordinate[],
  maximumGapM = MAX_SAMPLE_GAP_M,
): Coordinate[] {
  if (coordinates.length < 2) return [...coordinates]
  const result: Coordinate[] = [coordinates[0]]
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1]
    const current = coordinates[index]
    const subdivisions = Math.max(
      1,
      Math.ceil(distanceBetween(previous, current) / maximumGapM),
    )
    for (let step = 1; step <= subdivisions; step += 1) {
      result.push(interpolateCoordinate(previous, current, step / subdivisions))
    }
  }
  return result
}

function roadClassAt(progress: number, curvature: number): RoadClass {
  if (progress < 0.16 || progress > 0.86) return 'urban'
  if (progress > 0.34 && progress < 0.72 && curvature < 0.3) return 'motorway'
  return 'road'
}

function speedLimitAt(
  roadClass: RoadClass,
  distanceM: number,
): number {
  const variation = Math.floor(distanceM / 260) % 3
  if (roadClass === 'urban') return 30 + variation * 10
  if (roadClass === 'road') return 70 + variation * 10
  return 100
}

function applyAccelerationEnvelope(points: RoutePoint[]): void {
  const acceleration = 1.8
  const braking = 3.2
  points[0].targetSpeedKph = 0
  points[points.length - 1].targetSpeedKph = 0

  for (let index = 1; index < points.length; index += 1) {
    const gap = points[index].distanceM - points[index - 1].distanceM
    const previousMps = points[index - 1].targetSpeedKph / 3.6
    const attainable = Math.sqrt(previousMps ** 2 + 2 * acceleration * gap)
    points[index].targetSpeedKph = Math.min(
      points[index].targetSpeedKph,
      attainable * 3.6,
    )
  }
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const gap = points[index + 1].distanceM - points[index].distanceM
    const nextMps = points[index + 1].targetSpeedKph / 3.6
    const attainable = Math.sqrt(nextMps ** 2 + 2 * braking * gap)
    points[index].targetSpeedKph = Math.min(
      points[index].targetSpeedKph,
      attainable * 3.6,
    )
  }
}

export function buildDriveRoute(
  rawCoordinates: readonly Coordinate[],
  source: DriveRoute['source'],
  roadSteps: RoadStep[] = [],
): DriveRoute {
  const coordinates = densifyRoute(rawCoordinates)
  if (coordinates.length < 2) {
    throw new Error('La ruta necesita al menos dos coordenadas')
  }

  const cumulative: number[] = [0]
  const bearings: number[] = []
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    cumulative.push(
      cumulative[index] +
        distanceBetween(coordinates[index], coordinates[index + 1]),
    )
    bearings.push(bearingBetween(coordinates[index], coordinates[index + 1]))
  }
  bearings.push(bearings[bearings.length - 1])
  const totalDistance = cumulative[cumulative.length - 1]
  const stepsDistance = roadSteps.reduce((sum, step) => sum + Math.max(0, step.distanceM), 0)
  const roadNameAt = (distanceM: number) => {
    if (!roadSteps.length || stepsDistance <= 0) return ''
    const routeDistance = distanceM * stepsDistance / Math.max(1, totalDistance)
    let cursor = 0
    let lastNamedRoad = ''
    for (const step of roadSteps) {
      if (step.name.trim()) lastNamedRoad = step.name.trim()
      cursor += Math.max(0, step.distanceM)
      if (routeDistance <= cursor) return lastNamedRoad
    }
    return lastNamedRoad
  }

  const points: RoutePoint[] = coordinates.map((coordinate, index) => {
    const previousBearing = bearings[Math.max(0, index - 1)]
    const nextBearing = bearings[Math.min(bearings.length - 1, index + 1)]
    const localDistance = Math.max(
      1,
      cumulative[Math.min(cumulative.length - 1, index + 1)] -
        cumulative[Math.max(0, index - 1)],
    )
    const curvature = clamp(
      (Math.abs(shortestAngle(previousBearing, nextBearing)) / localDistance) *
        12,
      0,
      1,
    )
    const progress = cumulative[index] / Math.max(1, totalDistance)
    const roadClass = roadClassAt(progress, curvature)
    const speedLimitKph = speedLimitAt(roadClass, cumulative[index])
    const curveFactor = clamp(1 - curvature * 0.68, 0.34, 1)
    return {
      coordinate,
      distanceM: cumulative[index],
      bearingDeg: bearings[index],
      curvature,
      roadClass,
      roadName: roadNameAt(cumulative[index]),
      speedLimitKph,
      targetSpeedKph: Math.max(18, speedLimitKph * 0.94 * curveFactor),
    }
  })

  applyAccelerationEnvelope(points)
  let durationS = 0
  for (let index = 1; index < points.length; index += 1) {
    const gap = points[index].distanceM - points[index - 1].distanceM
    const averageMps =
      Math.max(2, (points[index].targetSpeedKph + points[index - 1].targetSpeedKph) / 7.2)
    durationS += gap / averageMps
  }
  let stepCursor = 0
  const parsedManeuvers: RouteManeuver[] = roadSteps.flatMap((step) => {
    const distanceM = stepCursor * totalDistance / Math.max(1, stepsDistance)
    stepCursor += Math.max(0, step.distanceM)
    if (step.type === 'depart') return []
    const routePoint = points.reduce((closest, point) => Math.abs(point.distanceM - distanceM) < Math.abs(closest.distanceM - distanceM) ? point : closest, points[0])
    return [{
      distanceM: step.type === 'arrive' ? totalDistance : distanceM,
      coordinate: step.location ?? routePoint.coordinate,
      type: step.type,
      modifier: step.modifier,
      exit: step.exit,
      roadName: step.name.trim(),
      bearingAfter: step.bearingAfter,
    }]
  })
  const inferredManeuvers: RouteManeuver[] = []
  if (!parsedManeuvers.length) {
    for (let index = 2; index < points.length - 2; index += 1) {
      const point = points[index]
      const previous = inferredManeuvers[inferredManeuvers.length - 1]
      if (point.curvature < .055 || (previous && point.distanceM - previous.distanceM < 280)) continue
      const turn = shortestAngle(points[index - 2].bearingDeg, points[index + 2].bearingDeg)
      inferredManeuvers.push({ distanceM: point.distanceM, coordinate: point.coordinate, type: 'turn', modifier: turn < 0 ? 'left' : 'right', roadName: point.roadName, bearingAfter: point.bearingDeg })
    }
    inferredManeuvers.push({ distanceM: totalDistance, coordinate: points[points.length - 1].coordinate, type: 'arrive', modifier: 'straight', roadName: '' })
  }
  return { points, maneuvers: parsedManeuvers.length ? parsedManeuvers : inferredManeuvers, distanceM: totalDistance, durationS, source }
}

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

function extractCoordinates(payload: unknown): Coordinate[] | null {
  if (typeof payload !== 'object' || payload === null) return null
  const routes = Reflect.get(payload, 'routes')
  if (!Array.isArray(routes) || routes.length === 0) return null
  const geometry = Reflect.get(routes[0], 'geometry')
  if (typeof geometry !== 'object' || geometry === null) return null
  const coordinates = Reflect.get(geometry, 'coordinates')
  if (!Array.isArray(coordinates) || !coordinates.every(isCoordinate)) return null
  return coordinates.map(([longitude, latitude]) => [longitude, latitude])
}

function extractRoadSteps(payload: unknown): RoadStep[] {
  if (typeof payload !== 'object' || payload === null) return []
  const routes = Reflect.get(payload, 'routes')
  if (!Array.isArray(routes) || !routes.length) return []
  const legs = Reflect.get(routes[0], 'legs')
  if (!Array.isArray(legs)) return []
  return legs.flatMap((leg) => {
    if (typeof leg !== 'object' || leg === null) return []
    const steps = Reflect.get(leg, 'steps')
    if (!Array.isArray(steps)) return []
    return steps.flatMap((step) => {
      if (typeof step !== 'object' || step === null) return []
      const distanceM = Reflect.get(step, 'distance')
      const name = Reflect.get(step, 'name')
      const maneuver = Reflect.get(step, 'maneuver')
      if (typeof distanceM !== 'number' || !Number.isFinite(distanceM)) return []
      const type = typeof maneuver === 'object' && maneuver !== null && typeof Reflect.get(maneuver, 'type') === 'string' ? String(Reflect.get(maneuver, 'type')) : 'continue'
      const modifier = typeof maneuver === 'object' && maneuver !== null && typeof Reflect.get(maneuver, 'modifier') === 'string' ? String(Reflect.get(maneuver, 'modifier')) : 'straight'
      const rawExit = typeof maneuver === 'object' && maneuver !== null ? Reflect.get(maneuver, 'exit') : undefined
      const rawLocation = typeof maneuver === 'object' && maneuver !== null ? Reflect.get(maneuver, 'location') : undefined
      const rawBearing = typeof maneuver === 'object' && maneuver !== null ? Reflect.get(maneuver, 'bearing_after') : undefined
      return [{ distanceM, name: typeof name === 'string' ? name : '', type, modifier,
        exit: typeof rawExit === 'number' ? rawExit : undefined,
        location: isCoordinate(rawLocation) ? rawLocation : undefined,
        bearingAfter: typeof rawBearing === 'number' ? rawBearing : undefined }]
    })
  })
}

export async function fetchDemoRoute(
  start: Coordinate,
  end: Coordinate,
  signal?: AbortSignal,
): Promise<DriveRoute> {
  const coordinates = `${start[0]},${start[1]};${end[0]},${end[1]}`
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`
  const requestController = new AbortController()
  const timeout = window.setTimeout(() => requestController.abort(), 8_000)
  const forwardAbort = () => requestController.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })
  try {
    const response = await fetch(url, { signal: requestController.signal })
    if (!response.ok) throw new Error(`OSRM respondió ${response.status}`)
    const payload: unknown = await response.json()
    const routeCoordinates = extractCoordinates(payload)
    if (!routeCoordinates || routeCoordinates.length < 2) {
      throw new Error('OSRM devolvió una geometría vacía')
    }
    return buildDriveRoute(routeCoordinates, 'osrm', extractRoadSteps(payload))
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    const isOriginalDemo = distanceBetween(start, FALLBACK_ROUTE[0]) < 20 && distanceBetween(end, FALLBACK_ROUTE[FALLBACK_ROUTE.length - 1]) < 20
    if (isOriginalDemo) return buildDriveRoute(FALLBACK_ROUTE, 'fallback')
    throw error
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

export function createFallbackRoute(): DriveRoute {
  return buildDriveRoute(FALLBACK_ROUTE, 'fallback')
}
