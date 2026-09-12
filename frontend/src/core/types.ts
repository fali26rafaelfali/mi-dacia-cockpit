export type CockpitMode = 'idle' | 'demo' | 'real'

export interface Coordinates {
  latitude: number
  longitude: number
  altitude?: number | null
  accuracy?: number
  heading?: number | null
  speed?: number | null
  timestamp: number
}

export interface Telemetry {
  speedKmh: number
  rpm: number
  coolantCelsius?: number
  throttlePercent?: number
  engineLoadPercent?: number
  fuelPercent?: number
  voltage?: number
  odometerKm?: number
  updatedAt: number
  source: 'none' | 'demo' | 'gps' | 'obd'
}

export interface CockpitSettings {
  units: 'metric' | 'imperial'
  theme: 'dark' | 'light' | 'system'
  language: string
  voiceEnabled: boolean
  wakeLockEnabled: boolean
  motionEnabled: boolean
  radarAlertsEnabled: boolean
  overspeedToleranceKmh: number
  home?: Coordinates
}

export interface TripPoint extends Coordinates {
  speedKmh?: number
}

export interface Trip {
  id: string
  startedAt: number
  endedAt?: number
  distanceKm: number
  durationSeconds: number
  maxSpeedKmh: number
  averageSpeedKmh: number
  startLabel?: string
  endLabel?: string
  points: TripPoint[]
}

export interface Radar {
  id: string
  latitude: number
  longitude: number
  road?: string
  direction?: string
  speedLimitKmh?: number
  type: 'fixed' | 'mobile' | 'section' | 'traffic-light' | 'unknown'
  updatedAt?: number
}

export interface Refuel {
  id: string
  date: number
  liters: number
  totalPrice: number
  pricePerLiter: number
  odometerKm?: number
  station?: string
  fuelType?: string
  fullTank?: boolean
}

export interface Parking {
  id: string
  location: Coordinates
  parkedAt: number
  expiresAt?: number
  note?: string
  photoUrl?: string
}

export interface RouteStep {
  distanceMeters: number
  durationSeconds: number
  instruction: string
  name: string
  maneuver: {
    type: string
    modifier?: string
    location: [number, number]
  }
}

export interface Route {
  distanceMeters: number
  durationSeconds: number
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  steps: RouteStep[]
}

export interface Place {
  id: string
  displayName: string
  latitude: number
  longitude: number
  type?: string
  address?: Record<string, string>
}

export interface Weather {
  temperatureCelsius: number
  apparentTemperatureCelsius?: number
  humidityPercent?: number
  windKmh?: number
  weatherCode?: number
  isDay?: boolean
  observedAt: number
}

export interface FuelStation {
  id: string
  name: string
  address: string
  municipality?: string
  province?: string
  latitude: number
  longitude: number
  prices: Record<string, number>
  updatedAt?: number
}

export interface MotionReading {
  acceleration: { x: number | null; y: number | null; z: number | null }
  accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null }
  rotationRate: { alpha: number | null; beta: number | null; gamma: number | null }
  interval: number
  timestamp: number
}

export const DEFAULT_TELEMETRY: Telemetry = {
  speedKmh: 0,
  rpm: 0,
  updatedAt: 0,
  source: 'none',
}

export const DEFAULT_SETTINGS: CockpitSettings = {
  units: 'metric',
  theme: 'dark',
  language: 'es-ES',
  voiceEnabled: true,
  wakeLockEnabled: true,
  motionEnabled: false,
  radarAlertsEnabled: true,
  overspeedToleranceKmh: 5,
}
