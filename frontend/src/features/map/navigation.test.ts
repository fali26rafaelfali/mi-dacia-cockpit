import { expect, test } from 'vitest'
import { buildDriveRoute } from './route'
import { formatNavigationDistance, getGuidancePresentation, getNavigationInstruction } from './navigation'

test('describe una rotonda con número de salida y distancia profesional', () => {
  const route = buildDriveRoute([[-5.45, 36.14], [-5.44, 36.145], [-5.43, 36.15]], 'osrm', [
    { distanceM: 300, name: 'Avenida de España', type: 'depart', modifier: 'straight' },
    { distanceM: 200, name: 'A-7', type: 'roundabout', modifier: 'right', exit: 2 },
    { distanceM: 0, name: '', type: 'arrive', modifier: 'straight' },
  ])
  const navigation = getNavigationInstruction(route, 0, 'San Roque')
  expect(navigation.instruction).toBe('En la rotonda, toma la segunda salida hacia A-7')
  expect(navigation.arrow).toBe('⟳')
  expect(navigation.distanceM).toBeGreaterThan(500)
})

test('formatea metros y kilómetros para lectura rápida', () => {
  expect(formatNavigationDistance(497)).toBe('500 m')
  expect(formatNavigationDistance(1_240)).toBe('1,2 km')
})

test('mantiene recto cuando el giro está lejos y muestra el giro a 100 metros', () => {
  const route = buildDriveRoute([[-5.45, 36.14], [-5.44, 36.145], [-5.43, 36.15]], 'osrm', [
    { distanceM: 900, name: 'Calle Real', type: 'depart', modifier: 'straight' },
    { distanceM: 100, name: 'Calle Sol', type: 'turn', modifier: 'left' },
  ])
  const far = getNavigationInstruction(route, 0, 'Destino')
  expect(getGuidancePresentation(far, 'Calle Real', 'Destino')).toMatchObject({ instruction: 'Continúa recto por Calle Real', arrow: '↑', approachingTurn: false })
  const close = getNavigationInstruction(route, far.maneuver!.distanceM - 100, 'Destino')
  expect(getGuidancePresentation(close, 'Calle Real', 'Destino')).toMatchObject({ instruction: 'Gira a la izquierda hacia Calle Sol', arrow: '←', approachingTurn: true })
})
