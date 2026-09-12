import { useCallback, useEffect, useState } from 'react'
import type { MotionReading } from '../core/types'

interface PermissionMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

const vector = (value: DeviceMotionEventAcceleration | null) => ({
  x: value?.x ?? null,
  y: value?.y ?? null,
  z: value?.z ?? null,
})

export function useMotionSensors(enabled = false) {
  const supported = typeof window !== 'undefined' && 'DeviceMotionEvent' in window
  const [reading, setReading] = useState<MotionReading | null>(null)
  const [permission, setPermission] = useState<PermissionState | 'unknown'>('unknown')
  const [error, setError] = useState<Error | null>(null)

  const requestPermission = useCallback(async () => {
    try {
      const constructor = DeviceMotionEvent as unknown as PermissionMotionEvent
      const result = constructor.requestPermission ? await constructor.requestPermission() : 'granted'
      setPermission(result)
      return result === 'granted'
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error(String(reason)))
      setPermission('denied')
      return false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !supported || permission === 'denied') return
    const onMotion = (event: DeviceMotionEvent) => {
      setReading({
        acceleration: vector(event.acceleration),
        accelerationIncludingGravity: vector(event.accelerationIncludingGravity),
        rotationRate: {
          alpha: event.rotationRate?.alpha ?? null,
          beta: event.rotationRate?.beta ?? null,
          gamma: event.rotationRate?.gamma ?? null,
        },
        interval: event.interval,
        timestamp: Date.now(),
      })
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [enabled, permission, supported])

  return { supported, reading, permission, error, requestPermission }
}
