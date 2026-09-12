import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const publicBase = process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : '/'

export default defineConfig({
  base: publicBase,
  plugins: [
    react(),
    {
      name: 'maplibre-worker',
      generateBundle() {
        for (const fileName of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
          const sourcePath = fileURLToPath(
            new URL(`./node_modules/maplibre-gl/dist/${fileName}`, import.meta.url),
          )
          this.emitFile({
            type: 'asset',
            fileName: `assets/${fileName}`,
            source: readFileSync(sourcePath),
          })
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mi Dacia Cockpit',
        short_name: 'Dacia',
        description: 'Cockpit de conducción y navegación para Dacia Sandero',
        theme_color: '#e7edf3',
        background_color: '#e7edf3',
        display: 'standalone',
        orientation: 'landscape',
        start_url: publicBase,
        icons: [
          {
            src: `${publicBase}favicon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: `${publicBase}index.html`,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 350, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openstreetmap-tiles',
              expiration: { maxEntries: 350, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/dgt-incidencias': 'http://127.0.0.1:8000',
      '/osm-overpass': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
