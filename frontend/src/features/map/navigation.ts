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

export interface VoiceGuidance {
  stage: 'far' | 'near' | 'now'
  message: string
}

const ordinal = (exit: number) => {
  const names = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta']
  return names[exit] ?? `${exit}.ª`
}

export function formatNavigationDistance(distanceM: number): string {
  if (distanceM < 950) {
    const meters = Math.max(10, Math.round(distanceM / 10) * 10)
    return `${meters} ${meters === 1 ? 'metro' : 'metros'}`
  }
  const kilometers = Number((distanceM / 1000).toFixed(1))
  return `${kilometers.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${kilometers === 1 ? 'kilómetro' : 'kilómetros'}`
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
  if (/exit roundabout|exit rotary/.test(maneuver.type)) return { full: `Sal de la rotonda${road}`, short: 'Sal de la rotonda' }
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

export function getVoiceGuidance(navigation: NavigationInstruction, currentRoad: string): VoiceGuidance | null {
  const maneuver = navigation.maneuver
  if (maneuver && /exit roundabout|exit rotary/.test(maneuver.type)) return null
  const isRoundabout = maneuver ? /roundabout|rotary/.test(maneuver.type) : false
  const instruction = navigation.instruction.charAt(0).toLowerCase() + navigation.instruction.slice(1)

  if (navigation.distanceM <= 25) {
    if (isRoundabout && maneuver) {
      const exit = ordinal(Math.max(1, maneuver.exit ?? 1))
      const road = maneuver.roadName ? ` hacia ${maneuver.roadName}` : ''
      return { stage: 'now', message: `Entra en la rotonda. Sal por la ${exit} salida${road}` }
    }
    return { stage: 'now', message: `Ahora, ${instruction}` }
  }

  if (navigation.distanceM <= 115) {
    if (isRoundabout && maneuver) {
      const exit = ordinal(Math.max(1, maneuver.exit ?? 1))
      return { stage: 'near', message: `A 100 metros, rotonda. ${exit.charAt(0).toUpperCase() + exit.slice(1)} salida` }
    }
    return { stage: 'near', message: `Dentro de 100 metros, ${instruction}` }
  }

  return {
    stage: 'far',
    message: `Continúa recto durante ${navigation.distanceLabel}${currentRoad ? ` por ${currentRoad}` : ''}`,
  }
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
