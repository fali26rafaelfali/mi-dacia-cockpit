import { expect, test } from 'vitest'
import { buildDriveRoute } from './route'
import { foodRouteSegments, parseFoodStops, selectFoodStopsAhead } from './routePlaces'

test('conserva solo establecimientos reales próximos a la ruta', () => {
  const route = buildDriveRoute([[-5.45, 36.14], [-5.44, 36.145], [-5.43, 36.15]], 'osrm')
  const stops = parseFoodStops([
    { id: 1, type: 'node', lat: 36.1451, lon: -5.4401, tags: { amenity: 'restaurant', name: 'Venta del Camino', cuisine: 'regional' } },
    { id: 2, type: 'node', lat: 36.3, lon: -5.2, tags: { amenity: 'restaurant', name: 'Muy lejos' } },
    { id: 3, type: 'node', lat: 36.145, lon: -5.44, tags: { amenity: 'restaurant' } },
  ], route)

  expect(stops).toHaveLength(1)
  expect(stops[0]).toMatchObject({ name: 'Venta del Camino', kind: 'restaurant', cuisine: 'regional' })
  expect(stops[0].detourM).toBeLessThan(100)
})

test('ofrece únicamente paradas que todavía quedan por delante', () => {
  const route = buildDriveRoute([[-5.45, 36.14], [-5.44, 36.145], [-5.43, 36.15]], 'osrm')
  const stops = parseFoodStops([
    { id: 1, type: 'node', lat: 36.1401, lon: -5.4499, tags: { amenity: 'cafe', name: 'Inicio' } },
    { id: 2, type: 'node', lat: 36.1499, lon: -5.4301, tags: { amenity: 'restaurant', name: 'Destino' } },
  ], route)
  const selected = selectFoodStopsAhead(stops, route.distanceM / 2)
  expect(selected.map(({ name }) => name)).toEqual(['Destino'])
})


test('la búsqueda cubre curvas y destino en viajes largos con tramos solapados', () => {
  const route = buildDriveRoute([[-5.45, 36.14], [-5.1, 36.5], [-5.4, 36.8], [-4.9, 37]], 'osrm')
  const segments = foodRouteSegments(route)
  expect(segments.length).toBeGreaterThan(1)
  expect(segments[0][0]).toEqual(route.points[0].coordinate)
  expect(segments.at(-1)!.at(-1)).toEqual(route.points.at(-1)!.coordinate)
  segments.slice(1).forEach((segment, index) => expect(segment[0]).toEqual(segments[index].at(-1)))
})

test('no oculta restaurantes cercanos entre sí ni incluye los ya pasados', () => {
  const route = buildDriveRoute([[-5.45, 36.14], [-5.43, 36.15]], 'osrm')
  const stops = parseFoodStops([
    { id: 1, lat: 36.145, lon: -5.4401, tags: { amenity: 'restaurant', name: 'Uno' } },
    { id: 2, lat: 36.1451, lon: -5.4402, tags: { amenity: 'restaurant', name: 'Dos' } },
  ], route)
  expect(selectFoodStopsAhead(stops, 0)).toHaveLength(2)
  expect(selectFoodStopsAhead(stops, route.distanceM)).toHaveLength(0)
})
