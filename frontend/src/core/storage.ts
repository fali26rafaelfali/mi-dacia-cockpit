import type { CockpitSettings, Parking, Refuel, Trip } from './types'
import { DEFAULT_SETTINGS } from './types'

export const STORAGE_KEYS = {
  settings: 'cockpit_settings',
  trips: 'cockpit_trips',
  refuels: 'cockpit_refuels',
  parking: 'cockpit_parking',
  mode: 'cockpit_mode',
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

const available = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.localStorage !== undefined
  } catch {
    return false
  }
}

const readJson = <T>(key: StorageKey, fallback: T): T => {
  if (!available()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

const writeJson = (key: StorageKey, value: unknown): void => {
  if (!available()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // El almacenamiento puede estar bloqueado o sin cuota.
  }
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

export const cockpitStorage = {
  loadSettings(): CockpitSettings {
    const saved = readJson<Partial<CockpitSettings>>(STORAGE_KEYS.settings, {})
    return { ...DEFAULT_SETTINGS, ...saved }
  },
  saveSettings(value: CockpitSettings): void {
    writeJson(STORAGE_KEYS.settings, value)
  },
  loadTrips(): Trip[] {
    return asArray<Trip>(readJson<unknown>(STORAGE_KEYS.trips, []))
  },
  saveTrips(value: Trip[]): void {
    writeJson(STORAGE_KEYS.trips, value)
  },
  loadRefuels(): Refuel[] {
    const current = readJson<unknown>(STORAGE_KEYS.refuels, null)
    if (current !== null) return asArray<Refuel>(current)
    // Algunos builds antiguos usaban cockpit_fuel.
    if (!available()) return []
    try {
      return asArray<Refuel>(JSON.parse(window.localStorage.getItem('cockpit_fuel') ?? '[]'))
    } catch {
      return []
    }
  },
  saveRefuels(value: Refuel[]): void {
    writeJson(STORAGE_KEYS.refuels, value)
  },
  loadParking(): Parking | null {
    return readJson<Parking | null>(STORAGE_KEYS.parking, null)
  },
  saveParking(value: Parking | null): void {
    writeJson(STORAGE_KEYS.parking, value)
  },
  loadMode(): 'idle' | 'demo' | 'real' {
    if (!available()) return 'idle'
    const mode = window.localStorage.getItem(STORAGE_KEYS.mode)
    return mode === 'demo' || mode === 'real' ? mode : 'idle'
  },
  saveMode(value: 'idle' | 'demo' | 'real'): void {
    if (!available()) return
    try {
      window.localStorage.setItem(STORAGE_KEYS.mode, value)
    } catch {
      // Sin persistencia, el store sigue funcionando en memoria.
    }
  },
}
