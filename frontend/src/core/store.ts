import { create } from 'zustand'
import { cockpitStorage } from './storage'
import type {
  CockpitMode,
  CockpitSettings,
  Coordinates,
  Parking,
  Radar,
  Refuel,
  Telemetry,
  Trip,
} from './types'
import { DEFAULT_TELEMETRY } from './types'

export interface CockpitState {
  mode: CockpitMode
  telemetry: Telemetry
  position: Coordinates | null
  settings: CockpitSettings
  trips: Trip[]
  radars: Radar[]
  refuels: Refuel[]
  parking: Parking | null
  setMode: (mode: CockpitMode) => void
  updateTelemetry: (patch: Partial<Telemetry>) => void
  setPosition: (position: Coordinates | null) => void
  updateSettings: (patch: Partial<CockpitSettings>) => void
  addTrip: (trip: Trip) => void
  removeTrip: (id: string) => void
  setRadars: (radars: Radar[]) => void
  addRefuel: (refuel: Refuel) => void
  removeRefuel: (id: string) => void
  setParking: (parking: Parking | null) => void
  resetTelemetry: () => void
}

export const useCockpitStore = create<CockpitState>((set) => ({
  mode: cockpitStorage.loadMode(),
  telemetry: DEFAULT_TELEMETRY,
  position: null,
  settings: cockpitStorage.loadSettings(),
  trips: cockpitStorage.loadTrips(),
  radars: [],
  refuels: cockpitStorage.loadRefuels(),
  parking: cockpitStorage.loadParking(),

  setMode: (mode) => {
    cockpitStorage.saveMode(mode)
    set({ mode })
  },
  updateTelemetry: (patch) =>
    set((state) => ({ telemetry: { ...state.telemetry, ...patch, updatedAt: Date.now() } })),
  setPosition: (position) => set({ position }),
  updateSettings: (patch) =>
    set((state) => {
      const settings = { ...state.settings, ...patch }
      cockpitStorage.saveSettings(settings)
      return { settings }
    }),
  addTrip: (trip) =>
    set((state) => {
      const trips = [trip, ...state.trips]
      cockpitStorage.saveTrips(trips)
      return { trips }
    }),
  removeTrip: (id) =>
    set((state) => {
      const trips = state.trips.filter((trip) => trip.id !== id)
      cockpitStorage.saveTrips(trips)
      return { trips }
    }),
  setRadars: (radars) => set({ radars }),
  addRefuel: (refuel) =>
    set((state) => {
      const refuels = [refuel, ...state.refuels]
      cockpitStorage.saveRefuels(refuels)
      return { refuels }
    }),
  removeRefuel: (id) =>
    set((state) => {
      const refuels = state.refuels.filter((refuel) => refuel.id !== id)
      cockpitStorage.saveRefuels(refuels)
      return { refuels }
    }),
  setParking: (parking) => {
    cockpitStorage.saveParking(parking)
    set({ parking })
  },
  resetTelemetry: () => set({ telemetry: { ...DEFAULT_TELEMETRY } }),
}))
