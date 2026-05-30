import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo_puntualito.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000, // Aumentado a 5MB
      },
      manifest: {
        name: 'Puntualito',
        short_name: 'Puntualito',
        description: 'App de control de asistencia por GPS',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: '/logo_puntualito.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo_puntualito.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ],
})
