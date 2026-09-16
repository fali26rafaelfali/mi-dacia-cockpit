import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { DriveRoute } from './types'

type OsmTags = Record<string, string>

interface OverpassElement {
  id: number
  type: string
  lat?: number
  lon?: number
  tags?: OsmTags
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

function iconCanvas(draw: (context: CanvasRenderingContext2D) => void): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = 112
  canvas.height = 152
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D no disponible')
  context.scale(2, 2)
  draw(context)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

function signPost(context: CanvasRenderingContext2D, top = 38): void {
  context.save()
  context.shadowColor = '#0009'
  context.shadowBlur = 5
  context.shadowOffsetY = 3
  const post = context.createLinearGradient(24, 0, 32, 0)
  post.addColorStop(0, '#69737a')
  post.addColorStop(.45, '#e1e6e9')
  post.addColorStop(1, '#535c62')
  context.fillStyle = post
  context.beginPath()
  context.roundRect(25, top, 6, 34, 2)
  context.fill()
  context.restore()
}

function groundGlow(context: CanvasRenderingContext2D, color = '#65c8ff'): void {
  context.save()
  const glow = context.createRadialGradient(28, 70, 1, 28, 70, 21)
  glow.addColorStop(0, `${color}70`)
  glow.addColorStop(.55, `${color}24`)
  glow.addColorStop(1, '#00000000')
  context.fillStyle = glow
  context.scale(1, .28)
  context.beginPath()
  context.arc(28, 248, 21, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function gloss(context: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  const shine = context.createLinearGradient(x, y, x + width, y)
  shine.addColorStop(0, '#ffffff00')
  shine.addColorStop(.45, '#ffffff70')
  shine.addColorStop(.62, '#ffffff18')
  shine.addColorStop(1, '#ffffff00')
  context.fillStyle = shine
  context.fillRect(x, y, width, 3)
}

function treeIcon(): ImageData {
  return iconCanvas((context) => {
    groundGlow(context, '#5dff9a')
    const trunk = context.createLinearGradient(23, 0, 32, 0)
    trunk.addColorStop(0, '#4b2a18')
    trunk.addColorStop(.5, '#9b6840')
    trunk.addColorStop(1, '#382014')
    context.fillStyle = trunk
    context.beginPath()
    context.roundRect(24, 36, 8, 35, 3)
    context.fill()
    const crown = context.createRadialGradient(22, 22, 3, 28, 29, 25)
    crown.addColorStop(0, '#8cbd67')
    crown.addColorStop(.55, '#477f49')
    crown.addColorStop(1, '#245536')
    context.fillStyle = crown
    for (const [x, y, radius] of [[18, 31, 14], [37, 31, 14], [28, 17, 17], [28, 39, 16]] as const) {
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
    context.save()
    context.globalAlpha = .52
    context.fillStyle = '#c8ff9b'
    context.beginPath()
    context.arc(21, 15, 7, 0, Math.PI * 2)
    context.fill()
    context.restore()
  })
}

function lampIcon(): ImageData {
  return iconCanvas((context) => {
    groundGlow(context, '#ffd66c')
    context.strokeStyle = '#41484d'
    context.lineWidth = 4
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(23, 70)
    context.lineTo(23, 17)
    context.quadraticCurveTo(23, 8, 36, 8)
    context.stroke()
    context.fillStyle = '#d9d5be'
    context.beginPath()
    context.roundRect(32, 6, 15, 8, 3)
    context.fill()
    const light = context.createRadialGradient(39, 14, 1, 39, 24, 25)
    light.addColorStop(0, '#fff7b8b8')
    light.addColorStop(.35, '#ffd75a3d')
    light.addColorStop(1, '#ffd75a00')
    context.fillStyle = light
    context.beginPath()
    context.moveTo(32, 12)
    context.lineTo(47, 12)
    context.lineTo(55, 54)
    context.lineTo(19, 54)
    context.closePath()
    context.fill()
  })
}

function trafficSignalIcon(): ImageData {
  return iconCanvas((context) => {
    groundGlow(context, '#41ef8a')
    signPost(context, 43)
    context.save()
    context.shadowColor = '#000b'
    context.shadowBlur = 7
    context.shadowOffsetY = 4
    const body = context.createLinearGradient(15, 0, 42, 0)
    body.addColorStop(0, '#0d1114')
    body.addColorStop(.5, '#353d42')
    body.addColorStop(1, '#090c0e')
    context.fillStyle = body
    context.beginPath()
    context.roundRect(15, 2, 26, 47, 6)
    context.fill()
    context.restore()
    for (const [color, y] of [['#ff3b35', 11], ['#ffc52e', 25], ['#35dc78', 39]] as const) {
      context.fillStyle = '#080b0d'
      context.beginPath()
      context.arc(28, y, 7, 0, Math.PI * 2)
      context.fill()
      context.save()
      context.shadowColor = color
      context.shadowBlur = 8
      context.fillStyle = color
      context.beginPath()
      context.arc(28, y, 4.5, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = '#ffffffa8'
      context.beginPath()
      context.arc(26.5, y - 1.5, 1.2, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }
    gloss(context, 17, 5, 22)
  })
}

function cameraIcon(): ImageData {
  return iconCanvas((context) => {
    groundGlow(context, '#64c8ff')
    context.fillStyle = '#31383d'
    context.fillRect(25, 37, 5, 34)
    context.fillStyle = '#f2f5f7'
    context.strokeStyle = '#29333a'
    context.lineWidth = 3
    context.beginPath()
    context.roundRect(9, 10, 38, 30, 7)
    context.fill()
    context.stroke()
    context.fillStyle = '#182129'
    context.beginPath()
    context.arc(29, 25, 9, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#73c7ff'
    context.beginPath()
    context.arc(29, 25, 4, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#eaffff'
    context.beginPath()
    context.arc(27, 23, 1.5, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#ff4242'
    context.shadowColor = '#ff4242'
    context.shadowBlur = 7
    context.beginPath()
    context.arc(42, 16, 2, 0, Math.PI * 2)
    context.fill()
  })
}

function crossingIcon(): ImageData {
  return iconCanvas((context) => {
    groundGlow(context, '#4da7ff')
    context.save()
    context.shadowColor = '#258dff'
    context.shadowBlur = 10
    context.fillStyle = '#ffffff'
    context.strokeStyle = '#1768a9'
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(28, 3)
    context.lineTo(51, 43)
    context.lineTo(5, 43)
    context.closePath()
    context.fill()
    context.stroke()
    context.restore()
    context.strokeStyle = '#1f2930'
    context.lineWidth = 4
    context.beginPath()
    context.arc(28, 15, 4, 0, Math.PI * 2)
    context.moveTo(28, 20)
    context.lineTo(25, 31)
    context.moveTo(26, 24)
    context.lineTo(18, 29)
    context.moveTo(25, 31)
    context.lineTo(18, 38)
    context.moveTo(25, 31)
    context.lineTo(35, 38)
    context.stroke()
    gloss(context, 11, 8, 34)
  })
}

function roadSignIcon(kind: string): ImageData {
  return iconCanvas((context) => {
    groundGlow(context, kind === 'stop' || kind === 'yield' ? '#ff4c4c' : '#ffffff')
    signPost(context)
    context.save()
    context.shadowColor = '#000b'
    context.shadowBlur = 7
    context.shadowOffsetY = 4
    if (kind === 'stop') {
      context.fillStyle = '#d92727'
      context.strokeStyle = '#fff'
      context.lineWidth = 2
      context.beginPath()
      for (let index = 0; index < 8; index += 1) {
        const angle = Math.PI / 8 + index * Math.PI / 4
        const x = 28 + 18 * Math.cos(angle)
        const y = 21 + 18 * Math.sin(angle)
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.closePath()
      context.fill()
      context.stroke()
      context.fillStyle = '#fff'
      context.font = '900 9px system-ui, sans-serif'
      context.textAlign = 'center'
      context.fillText('STOP', 28, 24)
      gloss(context, 15, 9, 26)
      context.restore()
      return
    }
    if (kind === 'yield') {
      context.fillStyle = '#fff'
      context.strokeStyle = '#d92727'
      context.lineWidth = 5
      context.beginPath()
      context.moveTo(9, 7)
      context.lineTo(47, 7)
      context.lineTo(28, 42)
      context.closePath()
      context.fill()
      context.stroke()
      gloss(context, 14, 10, 28)
      context.restore()
      return
    }
    const speed = kind.replace('speed-', '')
    context.fillStyle = '#fff'
    context.strokeStyle = '#d92727'
    context.lineWidth = 5
    context.beginPath()
    context.arc(28, 22, 19, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.restore()
    context.fillStyle = '#15191d'
    context.font = '900 16px system-ui, sans-serif'
    context.textAlign = 'center'
    context.fillText(speed, 28, 28)
    gloss(context, 14, 10, 28)
  })
}

function signIcon(tags: OsmTags): string | undefined {
  if (tags.highway === 'traffic_signals') return 'signal'
  if (tags.highway === 'speed_camera') return 'camera'
  if (tags.highway === 'crossing') return 'crossing'
  if (tags.highway === 'stop') return 'stop'
  if (tags.highway === 'give_way') return 'yield'
  const speed = tags.traffic_sign?.match(/(?:20|30|40|50|60|70|80|90|100|120)(?!\d)/)?.[0]
  return speed ? `speed-${speed}` : undefined
}

// Navigation badges: a consistent silhouette, large pictogram and a short label.
// The traffic-light pictogram marks a location, not a live signal state.
function navigationBadge(source: ImageData, label: string, accent: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = 144
  canvas.height = 176
  const context = canvas.getContext('2d')!
  const pictogram = document.createElement('canvas')
  pictogram.width = source.width
  pictogram.height = source.height
  pictogram.getContext('2d')!.putImageData(source, 0, 0)
  context.scale(2, 2)
  context.shadowColor = '#00000090'
  context.shadowBlur = 8
  context.shadowOffsetY = 3
  context.fillStyle = '#0b1c2b'
  context.strokeStyle = accent
  context.lineWidth = 2
  context.beginPath()
  context.roundRect(5, 4, 62, 70, 14)
  context.fill()
  context.stroke()
  context.shadowBlur = 0
  context.shadowOffsetY = 0
  context.fillStyle = accent
  context.beginPath()
  context.moveTo(29, 74)
  context.lineTo(36, 84)
  context.lineTo(43, 74)
  context.fill()
  context.drawImage(pictogram, 0, 0, 112, 100, 8, 8, 56, 50)
  context.fillStyle = '#ffffff'
  context.font = '800 8px system-ui, sans-serif'
  context.textAlign = 'center'
  context.fillText(label, 36, 67)
  return context.getImageData(0, 0, 144, 176)
}

function routeBounds(route: DriveRoute, buffer = .006): [number, number, number, number] {
  const longitudes = route.points.map((point) => point.coordinate[0])
  const latitudes = route.points.map((point) => point.coordinate[1])
  return [
    Math.min(...latitudes) - buffer,
    Math.min(...longitudes) - buffer,
    Math.max(...latitudes) + buffer,
    Math.max(...longitudes) + buffer,
  ]
}

function evenlyLimit<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items
  const step = items.length / limit
  return Array.from({ length: limit }, (_, index) => items[Math.floor(index * step)])
}

export function installOsmFurniture(map: MapLibreMap): void {
  const images: Record<string, ImageData> = {
    'osm-tree': treeIcon(),
    'osm-lamp': lampIcon(),
    'osm-signal': trafficSignalIcon(),
    'osm-camera': cameraIcon(),
    'osm-crossing': crossingIcon(),
    'osm-stop': roadSignIcon('stop'),
    'osm-yield': roadSignIcon('yield'),
  }
  for (const speed of [20, 30, 40, 50, 60, 70, 80, 90, 100, 120]) {
    images[`osm-speed-${speed}`] = roadSignIcon(`speed-${speed}`)
  }
  const labels: Record<string, [string, string]> = {
    'osm-signal': ['SEMÁFORO', '#ffcf59'],
    'osm-camera': ['RADAR', '#60d5ff'],
    'osm-crossing': ['PEATONES', '#70b6ff'],
    'osm-stop': ['STOP', '#ff7272'],
    'osm-yield': ['CEDA', '#ff9470'],
  }
  for (const [name, image] of Object.entries(images)) {
    const badge = labels[name] ?? (name.startsWith('osm-speed-') ? ['km/h', '#ff7272'] : undefined)
    if (badge) images[name] = navigationBadge(image, badge[0], badge[1])
  }
  for (const [name, image] of Object.entries(images)) {
    if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: 2 })
  }

  const empty = { type: 'FeatureCollection' as const, features: [] }
  map.addSource('osm-road-furniture', { type: 'geojson', data: empty })
  map.addLayer({
    id: 'osm-trees', type: 'symbol', source: 'osm-road-furniture', minzoom: 16,
    filter: ['==', ['get', 'kind'], 'tree'],
    layout: { 'icon-image': 'osm-tree', 'icon-anchor': 'bottom', 'icon-size': ['interpolate', ['linear'], ['zoom'], 16, .5, 19.5, 1, 21, 1.35], 'icon-allow-overlap': false, 'icon-padding': 3, 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport' },
  })
  map.addLayer({
    id: 'osm-lamps', type: 'symbol', source: 'osm-road-furniture', minzoom: 16.5,
    filter: ['==', ['get', 'kind'], 'lamp'],
    layout: { 'icon-image': 'osm-lamp', 'icon-anchor': 'bottom', 'icon-size': ['interpolate', ['linear'], ['zoom'], 16.5, .48, 19.5, .9, 21, 1.2], 'icon-allow-overlap': false, 'icon-padding': 5, 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport' },
  })
  map.addLayer({
    id: 'osm-signs', type: 'symbol', source: 'osm-road-furniture', minzoom: 14,
    filter: ['==', ['get', 'kind'], 'sign'],
    layout: { 'icon-image': ['concat', 'osm-', ['get', 'icon']], 'icon-anchor': 'bottom', 'icon-size': ['interpolate', ['linear'], ['zoom'], 14, .55, 16, .72, 18, .9, 19.5, 1, 21, 1.1], 'icon-allow-overlap': false, 'icon-padding': 6, 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport' },
  })
  map.addLayer({
    id: 'osm-peaks', type: 'symbol', source: 'osm-road-furniture', minzoom: 10, maxzoom: 17.8,
    filter: ['==', ['get', 'kind'], 'peak'],
    layout: {
      'text-field': ['concat', '▲ ', ['get', 'name'], ['case', ['has', 'elevation'], ['concat', '\n', ['get', 'elevation'], ' m'], '']],
      'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 13],
      'text-anchor': 'bottom', 'text-offset': [0, -.5], 'text-allow-overlap': false,
      'symbol-height-offset': 18, 'symbol-height-anchor': 'ground',
    },
    paint: { 'text-color': '#f1f5f7', 'text-halo-color': '#17242dcc', 'text-halo-width': 2 },
  })
}

export async function loadRealOsmFurniture(map: MapLibreMap, route: DriveRoute, signal: AbortSignal): Promise<number> {
  const [south, west, north, east] = routeBounds(route)
  const bbox = `${south},${west},${north},${east}`
  const [peakSouth, peakWest, peakNorth, peakEast] = routeBounds(route, .08)
  const peakBbox = `${peakSouth},${peakWest},${peakNorth},${peakEast}`
  const query = `[out:json][timeout:22];(node["natural"="tree"](${bbox});node["highway"="street_lamp"](${bbox});node["highway"~"^(traffic_signals|stop|give_way|crossing|speed_camera)$"](${bbox});node["traffic_sign"](${bbox});node["natural"="peak"]["name"](${peakBbox}););out body 2200;`
  const hosted = window.location.hostname.endsWith('.github.io')
  const response = await fetch(hosted ? 'https://overpass-api.de/api/interpreter' : '/osm-overpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  })
  if (!response.ok) throw new Error(`Overpass respondió ${response.status}`)
  const data = await response.json() as OverpassResponse
  const parsedFeatures = (data.elements ?? []).flatMap((element) => {
    if (element.type !== 'node' || element.lat === undefined || element.lon === undefined) return []
    const tags = element.tags ?? {}
    let kind: 'tree' | 'lamp' | 'sign' | 'peak'
    let icon: string
    if (tags.natural === 'peak' && tags.name) {
      kind = 'peak'
      icon = 'peak'
    } else if (tags.natural === 'tree') {
      kind = 'tree'
      icon = 'tree'
    } else if (tags.highway === 'street_lamp') {
      kind = 'lamp'
      icon = 'lamp'
    } else {
      const resolvedIcon = signIcon(tags)
      if (!resolvedIcon) return []
      kind = 'sign'
      icon = resolvedIcon
    }
    const elevation = tags.ele?.match(/-?\d+(?:\.\d+)?/)?.[0]
    return [{ type: 'Feature' as const, id: element.id, properties: { kind, icon, name: tags.name ?? '', ...(elevation ? { elevation } : {}) }, geometry: { type: 'Point' as const, coordinates: [element.lon, element.lat] } }]
  })
  // Los elementos siguen siendo reales de OSM, pero evitamos saturar la GPU
  // de la tablet cuando una zona contiene miles de árboles o farolas.
  const signs = parsedFeatures.filter(({ properties }) => properties.kind === 'sign')
  const lamps = evenlyLimit(parsedFeatures.filter(({ properties }) => properties.kind === 'lamp'), 250)
  const trees = evenlyLimit(parsedFeatures.filter(({ properties }) => properties.kind === 'tree'), 500)
  const peaks = evenlyLimit(parsedFeatures.filter(({ properties }) => properties.kind === 'peak'), 80)
  const features = [...trees, ...lamps, ...signs, ...peaks]
  const source = map.getSource('osm-road-furniture') as GeoJSONSource | undefined
  if (source) source.setData({ type: 'FeatureCollection', features })
  return features.length
}
