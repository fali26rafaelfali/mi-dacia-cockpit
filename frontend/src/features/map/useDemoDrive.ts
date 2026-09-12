import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DemoDriveController,
  DriveRoute,
  DriveTelemetry,
  RoutePoint,
  VehiclePose,
} from './types'

interface UseDemoDriveOptions {
  route: DriveRoute
  autoPlay?: boolean
  onTelemetry?: (telemetry: DriveTelemetry) => void
}

interface MotionState {
  distanceM: number
  speedKph: number
  elapsedS: number
  playing: boolean
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

function interpolateAngle(from: number, to: number, amount: number): number {
  const delta = ((to - from + 540) % 360) - 180
  return (from + delta * amount + 360) % 360
}

export function pointAtDistance(points: RoutePoint[], distanceM: number): VehiclePose {
  let low = 0
  let high = points.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (points[middle].distanceM < distanceM) low = middle + 1
    else high = middle
  }
  const nextIndex = Math.max(1, low)
  const previous = points[nextIndex - 1]
  const next = points[nextIndex]
  const span = Math.max(0.001, next.distanceM - previous.distanceM)
  const amount = clamp((distanceM - previous.distanceM) / span, 0, 1)
  return {
    coordinate: [
      previous.coordinate[0] +
        (next.coordinate[0] - previous.coordinate[0]) * amount,
      previous.coordinate[1] +
        (next.coordinate[1] - previous.coordinate[1]) * amount,
    ],
    bearingDeg: interpolateAngle(
      previous.bearingDeg,
      next.bearingDeg,
      amount,
    ),
    speedKph: 0,
    targetSpeedKph:
      previous.targetSpeedKph +
      (next.targetSpeedKph - previous.targetSpeedKph) * amount,
    progress:
      distanceM / Math.max(1, points[points.length - 1].distanceM),
    distanceM,
    roadClass: amount < 0.5 ? previous.roadClass : next.roadClass,
    roadName: amount < 0.5 ? previous.roadName : next.roadName,
  }
}

function telemetryFrom(
  route: DriveRoute,
  motion: MotionState,
): DriveTelemetry {
  const pose = pointAtDistance(route.points, motion.distanceM)
  return {
    ...pose,
    speedKph: motion.speedKph,
    elapsedS: motion.elapsedS,
    isPlaying: motion.playing,
    routeSource: route.source,
  }
}

export function useDemoDrive({
  route,
  autoPlay = true,
  onTelemetry,
}: UseDemoDriveOptions): DemoDriveController {
  const initialMotion: MotionState = {
    distanceM: 0,
    speedKph: 0,
    elapsedS: 0,
    playing: autoPlay,
  }
  const motionRef = useRef(initialMotion)
  const callbackRef = useRef(onTelemetry)
  const frameRef = useRef<number | null>(null)
  const previousTimeRef = useRef<number | null>(null)
  const lastPublishTimeRef = useRef(0)
  const [telemetry, setTelemetry] = useState(() =>
    telemetryFrom(route, initialMotion),
  )
  const liveTelemetry = useRef(telemetry)

  useEffect(() => {
    callbackRef.current = onTelemetry
  }, [onTelemetry])

  const publish = useCallback(
    (motion: MotionState) => {
      const next = telemetryFrom(route, motion)
      liveTelemetry.current = next
      setTelemetry(next)
      callbackRef.current?.(next)
    },
    [route],
  )

  const play = useCallback(() => {
    const motion = motionRef.current
    if (motion.distanceM >= route.distanceM) {
      motionRef.current = { ...motion, distanceM: 0, elapsedS: 0, speedKph: 0 }
    }
    motionRef.current = { ...motionRef.current, playing: true }
    previousTimeRef.current = null
    publish(motionRef.current)
  }, [publish, route.distanceM])

  const pause = useCallback(() => {
    motionRef.current = { ...motionRef.current, playing: false }
    publish(motionRef.current)
  }, [publish])

  const reset = useCallback(() => {
    motionRef.current = {
      distanceM: 0,
      speedKph: 0,
      elapsedS: 0,
      playing: false,
    }
    previousTimeRef.current = null
    publish(motionRef.current)
  }, [publish])

  const seek = useCallback(
    (progress: number) => {
      motionRef.current = {
        ...motionRef.current,
        distanceM: clamp(progress, 0, 1) * route.distanceM,
        speedKph: 0,
      }
      previousTimeRef.current = null
      publish(motionRef.current)
    },
    [publish, route.distanceM],
  )

  useEffect(() => {
    motionRef.current = {
      distanceM: 0,
      speedKph: 0,
      elapsedS: 0,
      playing: autoPlay,
    }
    previousTimeRef.current = null
    publish(motionRef.current)
  }, [autoPlay, publish, route])

  useEffect(() => {
    const tick = (time: number) => {
      const previousTime = previousTimeRef.current ?? time
      previousTimeRef.current = time
      const deltaS = Math.min(0.05, Math.max(0, (time - previousTime) / 1000))
      const motion = motionRef.current

      if (motion.playing && deltaS > 0) {
        const targetPose = pointAtDistance(
          route.points,
          Math.min(route.distanceM, motion.distanceM + 12),
        )
        const difference = targetPose.targetSpeedKph - motion.speedKph
        const maximumChange =
          (difference >= 0 ? 7.2 : 14.4) * deltaS
        const speedKph =
          motion.speedKph + clamp(difference, -maximumChange, maximumChange)
        const distanceM = Math.min(
          route.distanceM,
          motion.distanceM + (speedKph / 3.6) * deltaS,
        )
        const nextMotion = {
          distanceM,
          speedKph: distanceM >= route.distanceM ? 0 : speedKph,
          elapsedS: motion.elapsedS + deltaS,
          playing: distanceM < route.distanceM,
        }
        motionRef.current = nextMotion
        // El mapa lee cada fotograma; los paneles solo necesitan diez actualizaciones/s.
        liveTelemetry.current = telemetryFrom(route, nextMotion)
        if (time - lastPublishTimeRef.current >= 100 || !nextMotion.playing) {
          lastPublishTimeRef.current = time
          publish(nextMotion)
        }
      }
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      previousTimeRef.current = null
    }
  }, [publish, route])

  return { telemetry, liveTelemetry, play, pause, reset, seek }
}
