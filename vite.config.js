import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "single" mode builds one self-contained HTML file (used for quick previews).
// Normal mode builds the installable, offline-capable PWA for Vercel.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: [
      react(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,woff,woff2,png,ico}'],
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              navigateFallback: '/index.html',
            },
            manifest: {
              name: 'Redi POS — Clothing & Textile',
              short_name: 'Redi POS',
              description: 'Sinhala & English POS for clothing and textile shops',
              theme_color: '#1F2A5C',
              background_color: '#F5F6FA',
              display: 'standalone',
              start_url: '/app',
              icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            },
          }),
    ],
    define: { __SINGLE__: JSON.stringify(single) },
    build: single ? { outDir: 'dist-single', assetsInlineLimit: 100000000 } : { outDir: mode === 'server' ? 'dist-server' : 'dist', chunkSizeWarningLimit: 2000 },
  };
});
