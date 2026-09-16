import { expect, test, vi } from 'vitest'
import type { Map } from 'maplibre-gl'
import { buildDriveRoute } from './route'
import { updateNextManeuver } from './Maneuvers3D'

test('centra la indicación en el trazado azul aunque la maniobra llegue desplazada', () => {
  const route = buildDriveRoute([[-5.45, 36.14], [-5.43, 36.15]], 'osrm')
  const point = route.points[5]
  route.maneuvers = [{ distanceM: point.distanceM, coordinate: [-5.5, 36.2], type: 'off ramp', modifier: 'right', roadName: 'Salida' }]
  const setData = vi.fn()
  const map = { getSource: () => ({ setData }) } as unknown as Map
  updateNextManeuver(map, route, point.distanceM - 80)
  expect(setData.mock.calls[0][0].features[0].geometry.coordinates).toEqual(point.coordinate)
  updateNextManeuver(map, route, point.distanceM + 10)
  expect(setData.mock.calls[1][0].features).toEqual([])
})
