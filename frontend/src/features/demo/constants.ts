import type { Coordinate } from '../map/types'

export const LA_LINEA: Coordinate = [-5.3495, 36.1688]
export const SAN_ROQUE: Coordinate = [-5.3843, 36.2105]

export const OPENFREEMAP_LIBERTY =
  'https://tiles.openfreemap.org/styles/liberty'
export const MAPTERHORN_TILEJSON =
  'https://tiles.mapterhorn.com/tilejson.json'
export const OSRM_BASE_URL = 'https://router.project-osrm.org'

/**
 * Trazado local deliberadamente curvo y razonable. Mantiene la demo operativa
 * cuando OSRM no responde; no pretende sustituir navegación giro a giro.
 */
export const FALLBACK_ROUTE: readonly Coordinate[] = [
  LA_LINEA,
  [-5.3504, 36.1712],
  [-5.3524, 36.1744],
  [-5.3559, 36.1771],
  [-5.3597, 36.1801],
  [-5.3631, 36.1840],
  [-5.3667, 36.1883],
  [-5.3706, 36.1926],
  [-5.3738, 36.1970],
  [-5.3772, 36.2013],
  [-5.3808, 36.2056],
  SAN_ROQUE,
]

export const DEMO_MAP_INITIAL_VIEW = {
  center: LA_LINEA,
  zoom: 15.7,
  pitch: 66,
  bearing: -18,
} as const
