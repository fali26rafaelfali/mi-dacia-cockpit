import { useEffect, useMemo, useState } from 'react'
import { fetchFoodStops, fetchMunicipality, type FoodStop } from './routePlaces'
import type { DriveRoute } from './types'

export function useRouteContext(route: DriveRoute, distanceM: number) {
  const [municipality, setMunicipality] = useState('')
  const [foodStops, setFoodStops] = useState<FoodStop[]>([])
  const [foodLoading, setFoodLoading] = useState(false)
  const [foodError, setFoodError] = useState('')
  const distanceBucket = Math.floor(distanceM / 2_500)
  const localityCoordinate = useMemo(() => route.points.find((point) => point.distanceM >= distanceBucket * 2_500)?.coordinate ?? route.points.at(-1)!.coordinate, [distanceBucket, route])

  useEffect(() => {
    const controller = new AbortController()
    void fetchMunicipality(localityCoordinate, controller.signal).then(setMunicipality).catch(() => undefined)
    return () => controller.abort()
  }, [localityCoordinate])

  useEffect(() => {
    const controller = new AbortController()
    setFoodLoading(true)
    setFoodError('')
    setFoodStops([])
    void fetchFoodStops(route, controller.signal)
      .then(setFoodStops)
      .catch(() => { if (!controller.signal.aborted) setFoodError('No se pudieron consultar los restaurantes ahora mismo.') })
      .finally(() => { if (!controller.signal.aborted) setFoodLoading(false) })
    return () => controller.abort()
  }, [route])

  return { municipality, foodStops, foodLoading, foodError }
}
