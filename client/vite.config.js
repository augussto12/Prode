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
      injectRegister: false,
      devOptions: { enabled: true },
      manifest: {
        name: 'Prode Mundial 2026',
        short_name: 'Prode26',
        description: 'Plataforma de pronósticos para el mundial',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png', // Temporary generic trophy or user could add local
            sizes: '512x512',
            type: 'image/png'
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
