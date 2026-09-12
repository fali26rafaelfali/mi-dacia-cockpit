import type { DriveRoute, RouteManeuver } from './types'

export interface NavigationInstruction {
  maneuver: RouteManeuver | null
  distanceM: number
  distanceLabel: string
  instruction: string
  shortInstruction: string
  arrow: string
}

export interface GuidancePresentation {
  instruction: string
  roadName: string
  arrow: string
  approachingTurn: boolean
}

const ordinal = (exit: number) => {
  const names = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta']
  return names[exit] ?? `${exit}.ª`
}

export function formatNavigationDistance(distanceM: number): string {
  if (distanceM < 950) return `${Math.max(10, Math.round(distanceM / 10) * 10)} m`
  return `${(distanceM / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`
}

function arrowFor(maneuver: RouteManeuver): string {
  if (/roundabout|rotary/.test(maneuver.type)) return '⟳'
  if (maneuver.type === 'arrive') return '●'
  if (maneuver.modifier.includes('left')) return maneuver.modifier.includes('slight') ? '↖' : '←'
  if (maneuver.modifier.includes('right')) return maneuver.modifier.includes('slight') ? '↗' : '→'
  if (maneuver.modifier === 'uturn') return '↶'
  return '↑'
}

function describe(maneuver: RouteManeuver, destination: string): { full: string; short: string } {
  const road = maneuver.roadName ? ` hacia ${maneuver.roadName}` : ''
  if (maneuver.type === 'arrive') return { full: `Has llegado a ${destination}`, short: 'Llegada al destino' }
  if (/roundabout|rotary/.test(maneuver.type)) {
    const exit = ordinal(Math.max(1, maneuver.exit ?? 1))
    return { full: `En la rotonda, toma la ${exit} salida${road}`, short: `Rotonda · ${exit} salida` }
  }
  if (maneuver.type === 'merge') return { full: `Incorpórate${road}`, short: 'Incorpórate' }
  if (maneuver.type === 'fork') {
    const side = maneuver.modifier.includes('left') ? 'izquierda' : 'derecha'
    return { full: `Mantente a la ${side}${road}`, short: `Mantente a la ${side}` }
  }
  if (/on ramp|off ramp|ramp/.test(maneuver.type)) {
    const side = maneuver.modifier.includes('left') ? 'izquierda' : 'derecha'
    return { full: `Toma la salida a la ${side}${road}`, short: `Toma la salida` }
  }
  if (maneuver.modifier === 'uturn') return { full: `Haz un cambio de sentido${road}`, short: 'Cambio de sentido' }
  if (maneuver.modifier.includes('left')) {
    const action = maneuver.modifier.includes('slight') ? 'Continúa ligeramente a la izquierda' : 'Gira a la izquierda'
    return { full: `${action}${road}`, short: action }
  }
  if (maneuver.modifier.includes('right')) {
    const action = maneuver.modifier.includes('slight') ? 'Continúa ligeramente a la derecha' : 'Gira a la derecha'
    return { full: `${action}${road}`, short: action }
  }
  return { full: maneuver.roadName ? `Continúa por ${maneuver.roadName}` : 'Continúa recto', short: 'Continúa recto' }
}

export function getNavigationInstruction(route: DriveRoute, distanceM: number, destination: string): NavigationInstruction {
  const maneuver = route.maneuvers.find((candidate) => candidate.distanceM > distanceM + 4) ?? null
  if (!maneuver) return { maneuver: null, distanceM: 0, distanceLabel: '0 m', instruction: `Has llegado a ${destination}`, shortInstruction: 'Llegada al destino', arrow: '●' }
  const remaining = Math.max(0, maneuver.distanceM - distanceM)
  const description = describe(maneuver, destination)
  return { maneuver, distanceM: remaining, distanceLabel: formatNavigationDistance(remaining), instruction: description.full, shortInstruction: description.short, arrow: arrowFor(maneuver) }
}

export function getGuidancePresentation(navigation: NavigationInstruction, currentRoad: string, destination: string): GuidancePresentation {
  const approachingTurn = navigation.distanceM <= 115
  if (approachingTurn || !navigation.maneuver) {
    return {
      instruction: navigation.instruction,
      roadName: navigation.maneuver?.roadName ?? currentRoad,
      arrow: navigation.arrow,
      approachingTurn,
    }
  }
  const road = currentRoad || `dirección ${destination}`
  return {
    instruction: `Continúa recto por ${road}`,
    roadName: road,
    arrow: '↑',
    approachingTurn: false,
  }
}
