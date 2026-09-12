import type { ReactNode } from 'react'

export type CockpitTab = 'drive' | 'trip' | 'engine'
export type VehicleAlertLevel = 'info' | 'warning' | 'critical'
export type SystemState = 'ok' | 'warning' | 'error' | 'offline'

export interface VehicleAlert {
  id: string
  title: string
  description?: string
  level: VehicleAlertLevel
}

export interface StatusItem {
  id: string
  label: string
  value: string
  state?: SystemState
  icon?: ReactNode
}

export interface TripData {
  distanceKm: number
  durationMinutes: number
  durationSeconds?: number
  averageKmh: number
  maxSpeedKmh?: number
  consumptionL100Km: number
  consumedLiters?: number
  costEuro?: number
  gear?: string
  headingDeg?: number
  altitudeM?: number
  gradePercent?: number
  ecoScore?: number
}

export interface DiagnosticItem {
  id: string
  label: string
  detail: string
  state: SystemState
}

export interface DialogBaseProps {
  open: boolean
  onClose: () => void
}
