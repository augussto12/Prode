import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    }),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: { enabled: false },
      workbox: {
        importScripts: ['/share-target-sw.js'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Prode · Entre amigos',
        short_name: 'Prode',
        description: 'Tus grupos, apuestas compartidas y Prode entre amigos',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'images', accept: ['image/jpeg', 'image/png', 'image/webp', '.jpg', '.jpeg', '.png', '.webp'] }],
          },
        },
        icons: [
          {
            src: '/icon-512.png?v=2026-6',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-192.png?v=2026-6',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    target: ['es2020', 'chrome90', 'firefox88', 'safari14', 'edge90'],
    cssMinify: true,
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/framer-motion/')) {
            return 'motion';
          }
          if (id.includes('node_modules/socket.io-client/')) {
            return 'socket';
          }
          if (id.includes('node_modules/zustand/')) {
            return 'zustand';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons';
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'zustand']
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
});
