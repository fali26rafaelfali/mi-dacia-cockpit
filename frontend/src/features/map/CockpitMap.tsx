import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { DEMO_MAP_INITIAL_VIEW, OPENFREEMAP_LIBERTY } from '../demo/constants'
import type { DriveRoute, DriveTelemetry } from './types'
import { animateDriveMap, createVehicleMarker } from './animateDriveMap'
import { Car3D } from './Car3D'
import { installOsmFurniture, loadRealOsmFurniture } from './OsmFurniture'
import { applyMapWeather, installAdaptiveQuality, loadRealWeather } from './MapEnvironment'
import { installManeuverPreview } from './Maneuvers3D'

maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}assets/maplibre-gl-worker.mjs`)

function addRouteArrow(map: MapLibreMap) {
  const canvas = document.createElement('canvas')
  canvas.width = 24
  canvas.height = 40
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = 'rgba(255,255,255,.92)'
  context.beginPath()
  context.moveTo(12, 2)
  context.lineTo(22, 15)
  context.lineTo(16, 15)
  context.lineTo(16, 36)
  context.lineTo(8, 36)
  context.lineTo(8, 15)
  context.lineTo(2, 15)
  context.closePath()
  context.fill()
  map.addImage('route-direction-arrow', context.getImageData(0, 0, 24, 40), { pixelRatio: 2 })
}

function createFixedRouteArrows(route: DriveRoute) {
  let nextArrowM = 60
  const features = []
  for (const point of route.points) {
    if (point.distanceM < nextArrowM) continue
    features.push({
      type: 'Feature' as const,
      properties: { bearing: point.bearingDeg },
      geometry: { type: 'Point' as const, coordinates: [...point.coordinate] },
    })
    nextArrowM = point.distanceM + 140
  }
  return { type: 'FeatureCollection' as const, features }
}

export function CockpitMap({ route, telemetry, liveTelemetry, fromLabel, toLabel, municipality }: { route: DriveRoute; telemetry: DriveTelemetry; liveTelemetry: { current: DriveTelemetry }; fromLabel: string; toLabel: string; municipality?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [weather, setWeather] = useState('Tiempo real…')
  const [altitude, setAltitude] = useState<number | null>(null)
  const [quality, setQuality] = useState('Relieve')
  const [landscape, setLandscape] = useState(false)
  const landscapeRef = useRef(false)
  const toggleLandscape = () => {
    const next = !landscapeRef.current
    landscapeRef.current = next
    setLandscape(next)
    mapRef.current?.easeTo({ center: [...liveTelemetry.current.coordinate], zoom: next ? 14.5 : 18.25, pitch: next ? 72 : 69, duration: 800 })
  }

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return
    const furnitureController = new AbortController()
    let stopAdaptiveQuality: () => void = () => undefined
    const markerNode = document.createElement('div')
    markerNode.className = 'cockpit-vehicle-pin'
    const markerBubble = document.createElement('div')
    markerBubble.className = 'cockpit-vehicle-pin__bubble'
    const markerCar = document.createElement('img')
    markerCar.src = `${import.meta.env.BASE_URL}dacia-stepway-top.webp`
    markerCar.alt = ''
    markerBubble.appendChild(markerCar)
    const markerTip = document.createElement('span')
    markerTip.className = 'cockpit-vehicle-pin__tip'
    const closeCar = document.createElement('img')
    closeCar.className = 'cockpit-vehicle-pin__close-car'
    closeCar.src = `${import.meta.env.BASE_URL}dacia-stepway-rear-map.webp`
    closeCar.alt = ''
    markerNode.append(markerBubble, markerTip, closeCar)
    const map = new maplibregl.Map({
      container: hostRef.current,
      style: OPENFREEMAP_LIBERTY,
      center: [...DEMO_MAP_INITIAL_VIEW.center],
      zoom: DEMO_MAP_INITIAL_VIEW.zoom,
      pitch: DEMO_MAP_INITIAL_VIEW.pitch,
      bearing: DEMO_MAP_INITIAL_VIEW.bearing,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      maxTileCacheSize: 96,
      maxZoom: 21,
      maxPitch: 75,
      attributionControl: false,
    })
    map.setMissingStyleImageResolver((imageId) => {
      if (!map.hasImage(imageId)) {
        map.addImage(imageId, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) })
      }
    })
    mapRef.current = map
    const marker = createVehicleMarker(map, markerNode, liveTelemetry.current.coordinate)
    const stopAnimation = animateDriveMap(map, marker, closeCar, route, liveTelemetry, (meters) => setAltitude(Math.round(meters)), landscapeRef)
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      map.setLight({ anchor: 'map', color: '#fff1d5', intensity: 0.72, position: [1.25, 205, 48] })
      try {
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 15,
          encoding: 'terrarium',
          attribution: 'Terrain Tiles: AWS Open Data',
        })
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1 })
        // Una fuente separada para sombras evita compartir los cálculos del relieve.
        map.addSource('terrain-shading-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256, minzoom: 0, maxzoom: 15, encoding: 'terrarium',
        })
        const firstRoad = map.getStyle().layers?.find((layer) => layer.type === 'line' || layer.type === 'symbol' || layer.type === 'fill-extrusion')?.id
        map.addLayer({
          id: 'terrain-slopes', type: 'hillshade', source: 'terrain-shading-dem',
          paint: {
            'hillshade-exaggeration': .45,
            'hillshade-shadow-color': '#384435',
            'hillshade-highlight-color': '#fff3d5',
            'hillshade-accent-color': '#68765c',
            'hillshade-illumination-anchor': 'map',
          },
        }, firstRoad)
        map.setSky({ 'sky-color': '#80b7d9', 'horizon-color': '#d9e8ed', 'fog-color': '#d9e8ed', 'horizon-fog-blend': .15 })
      } catch (error) {
        console.warn('[Relieve real]', error)
      }
      if (map.getLayer('building-3d')) {
        map.setPaintProperty('building-3d', 'fill-extrusion-color', [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8],
          0, '#ddd8cf', 18, '#d0c7ba', 55, '#b8afa4', 140, '#9b958f',
        ])
        map.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.94)
        map.setPaintProperty('building-3d', 'fill-extrusion-vertical-gradient', true)
      }
      installOsmFurniture(map)
      stopAdaptiveQuality = installAdaptiveQuality(map, setQuality)
      void loadRealWeather(route.points[0].coordinate, furnitureController.signal).then((current) => {
        if (wrapRef.current) applyMapWeather(map, wrapRef.current, current)
        setWeather(`${current.label} · ${Math.round(current.temperatureC)} °C`)
      }).catch(() => {
        if (!furnitureController.signal.aborted) setWeather('Tiempo no disponible')
      })
      void loadRealOsmFurniture(map, route, furnitureController.signal).catch((error: unknown) => {
        if (!furnitureController.signal.aborted) console.warn('[Mobiliario OSM]', error)
      })
      const routeData = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: route.points.map((point) => [...point.coordinate]) } }
      map.addSource('demo-route', { type: 'geojson', data: routeData })
      // El coche y todas las partes del carril crecen juntos al acercar el mapa.
      const laneWidth = ['interpolate', ['linear'], ['zoom'], 13, 7, 16, 11, 17.8, 16, 19.5, 29, 21, 46] as maplibregl.ExpressionSpecification
      const routeWidth = ['interpolate', ['linear'], ['zoom'], 13, 3, 16, 6, 17.8, 10, 19.5, 18, 21, 28] as maplibregl.ExpressionSpecification
      const shadowWidth = ['interpolate', ['linear'], ['zoom'], 13, 12, 16, 16, 17.8, 21, 19.5, 37, 21, 58] as maplibregl.ExpressionSpecification
      const edgeOffset = ['interpolate', ['linear'], ['zoom'], 13, 3, 17.8, 6, 19.5, 11, 21, 17] as maplibregl.ExpressionSpecification
      const leftEdgeOffset = ['interpolate', ['linear'], ['zoom'], 13, -3, 17.8, -6, 19.5, -11, 21, -17] as maplibregl.ExpressionSpecification
      map.addLayer({ id: 'demo-route-shadow', type: 'line', source: 'demo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#06101a', 'line-width': shadowWidth, 'line-opacity': .58, 'line-blur': 1.2 } })
      map.addLayer({ id: 'demo-route-lane', type: 'line', source: 'demo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#183551', 'line-width': laneWidth, 'line-opacity': .94 } })
      map.addLayer({ id: 'demo-route-line', type: 'line', source: 'demo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#167ee8', 'line-width': routeWidth } })
      map.addLayer({ id: 'demo-route-highlight', type: 'line', source: 'demo-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#79c9ff', 'line-width': 1.5, 'line-opacity': .9 } })
      map.addLayer({ id: 'demo-route-edge-left', type: 'line', source: 'demo-route', paint: { 'line-color': '#e6f4ff', 'line-width': 1.1, 'line-offset': leftEdgeOffset, 'line-dasharray': [3, 3], 'line-opacity': .78 } })
      map.addLayer({ id: 'demo-route-edge-right', type: 'line', source: 'demo-route', paint: { 'line-color': '#e6f4ff', 'line-width': 1.1, 'line-offset': edgeOffset, 'line-dasharray': [3, 3], 'line-opacity': .78 } })
      addRouteArrow(map)
      installManeuverPreview(map)
      map.addSource('route-arrows', { type: 'geojson', data: createFixedRouteArrows(route) })
      map.addLayer({ id: 'demo-route-arrows', type: 'symbol', source: 'route-arrows', layout: { 'symbol-placement': 'point', 'icon-image': 'route-direction-arrow', 'icon-anchor': 'center', 'icon-offset': [0, 0], 'icon-rotate': ['get', 'bearing'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 13, .55, 17.8, .82, 19.5, 1.45, 21, 2], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map' } })
      map.addSource('route-travelled', { type: 'geojson', data: { ...routeData, geometry: { ...routeData.geometry, coordinates: [routeData.geometry.coordinates[0], routeData.geometry.coordinates[0]] } } })
      map.addLayer({ id: 'route-travelled-line', type: 'line', source: 'route-travelled', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#65beff', 'line-width': routeWidth, 'line-opacity': .72 } })
      map.moveLayer('demo-route-arrows')
      const bounds = new maplibregl.LngLatBounds()
      route.points.forEach((point) => bounds.extend([...point.coordinate]))
      map.fitBounds(bounds, { padding: { top: 80, right: 70, bottom: 180, left: 70 }, maxZoom: 15.8, duration: 0 })
      map.setPitch(58)
    })
    return () => {
      furnitureController.abort()
      stopAdaptiveQuality()
      stopAnimation()
      marker.remove()
      map.remove()
      mapRef.current = null
    }
  }, [route, liveTelemetry])

  return <div className="cockpit-map-wrap" ref={wrapRef}><div className="cockpit-map" ref={hostRef} /><div className="cockpit-map-label"><span>RUTA DEMO</span><strong>{fromLabel} → {toLabel}</strong><div className="cockpit-map-label__place"><div><span>CALLE ACTUAL</span><b>{telemetry.roadName || 'Vía sin nombre'}</b></div><div><span>LOCALIDAD</span><b>{municipality || 'Localizando…'}</b></div></div><div className="cockpit-map-label__environment"><em>{weather}</em><em>{altitude === null ? 'Altitud…' : `${altitude} m`}</em><em>{quality}</em></div><button className="cockpit-landscape-toggle" type="button" aria-pressed={landscape} onClick={toggleLandscape}>{landscape ? 'Volver al coche' : 'Paisaje 3D'}</button></div><Car3D speed={telemetry.speedKph} /></div>
}
