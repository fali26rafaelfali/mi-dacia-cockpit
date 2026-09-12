import { useEffect, useState } from 'react'
import type { Coordinates } from '../core/types'

export interface GeolocationState {
  position: Coordinates | null
  error: GeolocationPositionError | Error | null
  supported: boolean
  loading: boolean
}

export function useGeolocation(
  enabled = true,
  options: PositionOptions = { enableHighAccuracy: true, maximumAge: 1_000, timeout: 10_000 },
): GeolocationState {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const [state, setState] = useState<Omit<GeolocationState, 'supported'>>({
    position: null,
    error: null,
    loading: enabled && supported,
  })

  useEffect(() => {
    if (!enabled || !supported) {
      setState((current) => ({ ...current, loading: false }))
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) =>
        setState({
          position: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            altitude: coords.altitude,
            accuracy: coords.accuracy,
            heading: coords.heading,
            speed: coords.speed,
            timestamp,
          },
          error: null,
          loading: false,
        }),
      (error) => setState((current) => ({ ...current, error, loading: false })),
      options,
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled, supported, options.enableHighAccuracy, options.maximumAge, options.timeout])

  return { ...state, supported }
}
