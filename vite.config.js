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
        name: 'Turnio — Turni e Compensi',
        short_name: 'Turnio',
        description: 'Registro turni per sede con calcolo automatico di fatturato, rivalsa e tasse',
        theme_color: '#b91c1c',
        background_color: '#f9e9e5',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'it',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/jspdf-unused-optional-*.js'],
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
          // helper di Vite per gli import dinamici: va in un chunk caricato comunque all'avvio,
          // altrimenti finisce in quello di jsPDF e lo fa scaricare a ogni apertura dell'app
          if (id.includes('vite/preload-helper')) return 'react';
          if (id.includes('node_modules/xlsx')) return 'xlsx';
          if (id.includes('node_modules/jspdf')) return 'jspdf';
          // dipendenze opzionali di jsPDF (usate solo dal metodo .html(), che non usiamo):
          // isolate in chunk a parte così non finiscono nella cache offline della PWA
          if (id.includes('node_modules/html2canvas') || id.includes('node_modules/dompurify') || id.includes('node_modules/canvg')) {
            return 'jspdf-unused-optional';
          }
          if (id.includes('@supabase')) return 'supabase';
        },
      },
    },
  },
}));
