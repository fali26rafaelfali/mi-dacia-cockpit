import { afterEach, expect, test, vi } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { animateDriveMap, smoothAngle } from './animateDriveMap'
import { createFallbackRoute } from './route'
import type { DriveTelemetry } from './types'

afterEach(() => vi.restoreAllMocks())

test('coche por fotograma, ruta limitada, pausa, reinicio y limpieza', () => {
  const route = createFallbackRoute()
  const live = { current: { ...route.points[0], speedKph: 0, progress: 0, elapsedS: 0, isPlaying: false, routeSource: route.source } as DriveTelemetry }
  let callback: FrameRequestCallback = () => undefined
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { callback = cb; return 1 })
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const events = new Map<string, () => void>()
  const setData = vi.fn()
  const container = document.createElement('div')
  const node = document.createElement('div')
  const car = document.createElement('img')
  let zoom = 18.25
  const map = { on: (name: string, fn: () => void) => events.set(name, fn), off: vi.fn(),
    getContainer: () => container, getZoom: () => zoom, getBearing: () => 0,
    getPitch: () => 69, getSource: (id: string) => id === 'route-travelled' ? ({ setData }) : undefined, isMoving: () => false, easeTo: vi.fn(), jumpTo: vi.fn() }
  const marker = { getElement: () => node, setLngLat: vi.fn() }
  const stop = animateDriveMap(map as unknown as MapLibreMap, marker, car, route, live)
  for (let frame = 1; frame <= 120; frame++) {
    live.current = { ...live.current, isPlaying: true, distanceM: frame * .2, coordinate: route.points[1].coordinate }
    callback(frame * 1000 / 60)
  }
  expect(marker.setLngLat).toHaveBeenCalledTimes(120)
  expect(map.jumpTo.mock.calls.length).toBeGreaterThan(35)
  expect(setData.mock.calls.length).toBeLessThanOrEqual(8)
  live.current = { ...live.current, isPlaying: false }
  callback(2017)
  const pausedCalls = marker.setLngLat.mock.calls.length
  callback(2034)
  expect(marker.setLngLat).toHaveBeenCalledTimes(pausedCalls)
  live.current = { ...live.current, distanceM: 0, coordinate: route.points[0].coordinate }
  callback(2051)
  expect(marker.setLngLat).toHaveBeenLastCalledWith([...route.points[0].coordinate])
  expect(setData.mock.lastCall![0].geometry.coordinates).toHaveLength(2)
  zoom = 16
  events.get('move')!()
  expect(node.classList.contains('is-close')).toBe(false)
  zoom = 21
  events.get('move')!()
  expect(node.classList.contains('is-close')).toBe(true)
  container.dispatchEvent(new Event('pointerdown'))
  live.current = { ...live.current, isPlaying: true }
  const cameraCalls = map.jumpTo.mock.calls.length
  callback(4000)
  expect(map.jumpTo).toHaveBeenCalledTimes(cameraCalls)
  window.dispatchEvent(new Event('pointerup'))
  callback(5500)
  expect(map.easeTo.mock.lastCall![0].zoom).toBe(21)
  stop()
  expect(cancel).toHaveBeenCalled()
})

test('giro corto al cruzar el norte y suavizado independiente de los fps', () => {
  expect(smoothAngle(359, 1, 1 / 60, .2)).toBeGreaterThan(359)
  let at60 = 0
  let at30 = 0
  for (let i = 0; i < 60; i++) at60 = smoothAngle(at60, 90, 1 / 60, .2)
  for (let i = 0; i < 30; i++) at30 = smoothAngle(at30, 90, 1 / 30, .2)
  expect(at60).toBeCloseTo(at30, 8)
})
