import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base della webapp. Su Vercel (e su qualsiasi dominio alla radice) resta '/'.
// Per GitHub Pages sotto /AutoMarket/ imposta VITE_BASE=/AutoMarket/.
export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Turnify — Generatore Turni',
        short_name: 'Turnify',
        description: 'Generatore automatico di turni per il personale',
        theme_color: '#0ea5e9',
        background_color: '#181a20',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'it',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react';
          if (id.includes('node_modules/xlsx')) return 'xlsx';
        },
      },
    },
  },
}));
