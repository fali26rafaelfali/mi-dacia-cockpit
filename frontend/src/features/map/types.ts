export type Coordinate = readonly [longitude: number, latitude: number]

export type RoadClass = 'urban' | 'road' | 'motorway'

export interface RoutePoint {
  coordinate: Coordinate
  distanceM: number
  bearingDeg: number
  curvature: number
  roadClass: RoadClass
  speedLimitKph: number
  targetSpeedKph: number
  roadName: string
}

export interface DriveRoute {
  points: RoutePoint[]
  distanceM: number
  durationS: number
  source: 'osrm' | 'fallback'
}

export interface VehiclePose {
  coordinate: Coordinate
  bearingDeg: number
  speedKph: number
  targetSpeedKph: number
  progress: number
  distanceM: number
  roadClass: RoadClass
  roadName: string
}

export interface DriveTelemetry extends VehiclePose {
  elapsedS: number
  isPlaying: boolean
  routeSource: DriveRoute['source']
}

export interface DemoDriveController {
  telemetry: DriveTelemetry
  liveTelemetry: { current: DriveTelemetry }
  play: () => void
  pause: () => void
  reset: () => void
  seek: (progress: number) => void
}
