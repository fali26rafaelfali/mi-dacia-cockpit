// NIVEL B (prototipo): edificios foto-realistas de Google (Photorealistic 3D Tiles).
// Se dibujan con deck.gl (Tile3DLayer) superpuesto sobre el mapa MapLibre existente,
// así se conserva la ruta, el coche y las maniobras.
//
// REQUISITO: una clave de Google Maps Platform con la "Map Tiles API" activada y
// facturación habilitada. La clave se lee de VITE_GOOGLE3D_KEY (archivo .env.local,
// que NO se sube a git). Sin clave, este módulo ni se carga.
import { MapboxOverlay } from '@deck.gl/mapbox'
import { Tile3DLayer } from '@deck.gl/geo-layers'
import { Tiles3DLoader } from '@loaders.gl/3d-tiles'
import type { IControl, Map as MapLibreMap } from 'maplibre-gl'

const GOOGLE_3D_ROOT = 'https://tile.googleapis.com/v1/3dtiles/root.json'

export interface Photoreal3DController {
  setEnabled(enabled: boolean): void
  destroy(): void
}

export function createPhotoreal3D(map: MapLibreMap, apiKey: string): Photoreal3DController {
  const overlay = new MapboxOverlay({ interleaved: true, layers: [] })
  map.addControl(overlay as unknown as IControl)
  let enabled = false

  const buildLayers = () =>
    enabled
      ? [
          new Tile3DLayer({
            id: 'google-photoreal-3d',
            // El loader de loaders.gl detecta los tiles de Google y gestiona la sesión.
            data: `${GOOGLE_3D_ROOT}?key=${apiKey}`,
            loader: Tiles3DLoader,
            loadOptions: { '3d-tiles': { throttleRequests: true } },
          }),
        ]
      : []

  const syncBaseLayers = () => {
    // El 3D de Google ya trae suelo texturizado + edificios reales, así que ocultamos
    // nuestras cajas 3D y el satélite plano para no duplicar ni pelear por el z-buffer.
    if (map.getLayer('building-3d')) map.setLayoutProperty('building-3d', 'visibility', enabled ? 'none' : 'visible')
    if (map.getLayer('satellite-imagery') && enabled) map.setLayoutProperty('satellite-imagery', 'visibility', 'none')
  }

  return {
    setEnabled(next: boolean) {
      enabled = next
      overlay.setProps({ layers: buildLayers() })
      syncBaseLayers()
    },
    destroy() {
      try {
        map.removeControl(overlay as unknown as IControl)
      } catch {
        // El control ya podía estar retirado al desmontar el mapa.
      }
    },
  }
}
