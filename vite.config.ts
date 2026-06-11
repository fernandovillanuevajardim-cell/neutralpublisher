import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const basePath = process.env.VITE_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'neutralpublisher-icon.svg'],
      manifest: {
        name: 'NeutralPublisher',
        short_name: 'NeutralPublisher',
        description: 'Administrador y visor de carteleria digital para pantallas y Android TV.',
        theme_color: '#05070a',
        background_color: '#05070a',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: `${basePath}#/display`,
        scope: basePath,
        icons: [
          {
            src: `${basePath}neutralpublisher-icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: `${basePath}index.html`,
      },
    }),
  ],
})
