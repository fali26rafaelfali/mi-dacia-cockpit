import { useCallback, useEffect, useRef, useState } from 'react'
import { distanceBetween } from './route'
import type { DemoDriveController, DriveRoute, DriveTelemetry, RoutePoint } from './types'
import { pointAtDistance } from './useDemoDrive'

interface UseRealDriveOptions {
  route: DriveRoute
  enabled: boolean
}

export interface RealDriveController extends DemoDriveController {
  supported: boolean
  hasFix: boolean
  accuracyM: number | null
  altitudeM: number | null
  offRoute: boolean
  error: string | null
}

interface RealState {
  distanceM: number
  speedKph: number
  elapsedS: number
  playing: boolean
  coordinate: readonly [number, number] | null
  bearingDeg: number | null
  accuracyM: number | null
  altitudeM: number | null
  offRoute: boolean
  error: string | null
  startedAt: number | null
  lastFixAt: number | null
}

const initialState = (): RealState => ({
  distanceM: 0,
  speedKph: 0,
  elapsedS: 0,
  playing: false,
  coordinate: null,
  bearingDeg: null,
  accuracyM: null,
  altitudeM: null,
  offRoute: false,
  error: null,
  startedAt: null,
  lastFixAt: null,
})

function nearestRoutePoint(points: RoutePoint[], coordinate: readonly [number, number]) {
  let point = points[0]
  let distanceM = Number.POSITIVE_INFINITY
  for (const candidate of points) {
    const candidateDistance = distanceBetween(coordinate, candidate.coordinate)
    if (candidateDistance < distanceM) {
      point = candidate
      distanceM = candidateDistance
    }
  }
  return { point, distanceM }
}

function telemetryFrom(route: DriveRoute, state: RealState): DriveTelemetry {
  const pose = pointAtDistance(route.points, state.distanceM)
  const useGpsCoordinate = state.coordinate && state.offRoute
  return {
    ...pose,
    coordinate: useGpsCoordinate ? state.coordinate! : pose.coordinate,
    bearingDeg: state.bearingDeg ?? pose.bearingDeg,
    speedKph: state.speedKph,
    elapsedS: state.elapsedS,
    isPlaying: state.playing,
    roadName: state.offRoute ? 'Fuera de la ruta calculada' : pose.roadName,
    routeSource: route.source,
  }
}

function geolocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'Permiso de ubicación denegado. Actívalo en el navegador.'
  if (error.code === error.POSITION_UNAVAILABLE) return 'La tablet no encuentra señal GPS.'
  return 'El GPS tarda demasiado en responder.'
}

export function useRealDrive({ route, enabled }: UseRealDriveOptions): RealDriveController {
  const stateRef = useRef<RealState>(initialState())
  const previousRawRef = useRef<{ coordinate: readonly [number, number]; timestamp: number } | null>(null)
  const watchRef = useRef<number | null>(null)
  const [telemetry, setTelemetry] = useState(() => telemetryFrom(route, stateRef.current))
  const [status, setStatus] = useState(() => stateRef.current)
  const liveTelemetry = useRef(telemetry)

  const publish = useCallback((next: RealState) => {
    stateRef.current = next
    const nextTelemetry = telemetryFrom(route, next)
    liveTelemetry.current = nextTelemetry
    setTelemetry(nextTelemetry)
    setStatus(next)
  }, [route])

  const play = useCallback(() => {
    const now = Date.now()
    publish({ ...stateRef.current, playing: true, error: null, startedAt: stateRef.current.startedAt ?? now })
  }, [publish])

  const pause = useCallback(() => {
    publish({ ...stateRef.current, playing: false, speedKph: 0 })
  }, [publish])

  const reset = useCallback(() => {
    previousRawRef.current = null
    publish(initialState())
  }, [publish])

  const seek = useCallback(() => undefined, [])

  useEffect(() => {
    previousRawRef.current = null
    const keepPlaying = enabled && stateRef.current.playing
    publish({ ...initialState(), playing: keepPlaying, startedAt: keepPlaying ? Date.now() : null })
  }, [route, publish, enabled])

  useEffect(() => {
    if (!enabled || !status.playing || !('geolocation' in navigator)) {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
      return
    }

    watchRef.current = navigator.geolocation.watchPosition((position) => {
      const coordinate = [position.coords.longitude, position.coords.latitude] as const
      const nearest = nearestRoutePoint(route.points, coordinate)
      const accuracyM = position.coords.accuracy
      const snapLimitM = Math.max(45, Math.min(100, accuracyM * 1.5))
      const offRoute = nearest.distanceM > snapLimitM
      const previous = previousRawRef.current
      const deltaS = previous ? Math.max(.1, (position.timestamp - previous.timestamp) / 1000) : 0
      const derivedSpeed = previous && deltaS > 0 ? distanceBetween(previous.coordinate, coordinate) / deltaS * 3.6 : 0
      const measuredSpeed = position.coords.speed == null || position.coords.speed < 0 ? derivedSpeed : position.coords.speed * 3.6
      previousRawRef.current = { coordinate, timestamp: position.timestamp }
      const current = stateRef.current
      publish({
        ...current,
        coordinate,
        distanceM: Math.max(0, Math.min(route.distanceM, nearest.point.distanceM)),
        speedKph: Math.min(220, Math.max(0, measuredSpeed)),
        bearingDeg: position.coords.heading == null || Number.isNaN(position.coords.heading) ? nearest.point.bearingDeg : position.coords.heading,
        accuracyM,
        altitudeM: position.coords.altitude,
        offRoute,
        error: null,
        elapsedS: current.startedAt ? (Date.now() - current.startedAt) / 1000 : 0,
        lastFixAt: Date.now(),
      })
    }, (error) => {
      publish({ ...stateRef.current, error: geolocationError(error), speedKph: 0 })
    }, { enableHighAccuracy: true, maximumAge: 1_000, timeout: 15_000 })

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }, [enabled, status.playing, route, publish])

  useEffect(() => {
    if (enabled) play()
    else pause()
  // Solo responde al cambio de modo; play/pause cambian al recrearse la ruta.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  return {
    telemetry,
    liveTelemetry,
    play,
    pause,
    reset,
    seek,
    supported,
    hasFix: status.lastFixAt !== null,
    accuracyM: status.accuracyM,
    altitudeM: status.altitudeM,
    offRoute: status.offRoute,
    error: supported ? status.error : 'Este navegador no admite ubicación GPS.',
  }
}
