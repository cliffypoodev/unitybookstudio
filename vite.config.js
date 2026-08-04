// vite.config.js — FULL REPLACEMENT
// Removes @base44/vite-plugin. Adds path alias for @/ imports.

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import serverStorePlugin from './vite-server-store-plugin.js'

export default defineConfig({
  logLevel: 'error',
  plugins: [
    react(),
    serverStorePlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Allow Electron to load local files in production
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true, // Listen on all network interfaces
    port: 5180,
    strictPort: true,
    proxy: {
      // Proxy ComfyUI API requests to avoid CORS in browser
      // Browser hits localhost:5180/comfyui-api/... → forwarded to 127.0.0.1:8000/...
      // NETFIX-1: proxy the local llama.cpp + search bridge through the dev
      // server, so remote devices (Tailscale/LAN) reach the Studio's models via
      // the origin they already talk to. Same-origin => CSP-clean everywhere.
      '/llama': {
        // ROUTERSPLIT-1: UBS has its OWN llama router on 8081 (--models-max 1,
        // one model resident at a time). The 8080 router is left entirely alone
        // for other agents on this machine, so a UBS chapter run can never
        // evict their model or take both slots.
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llama/, ''),
      },
      '/search-bridge': {
        target: 'http://127.0.0.1:8899',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/search-bridge/, ''),
      },
      '/comfyui-api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comfyui-api/, ''),
      },
      // Proxy GitHub raw content to avoid CSP restrictions in browser.
      // Browser hits localhost:5180/github-raw/owner/repo/branch/file → forwarded to
      // https://raw.githubusercontent.com/owner/repo/branch/file
      '/github-raw': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-raw/, ''),
        secure: true,
      },
      // Proxy Base44 file API requests for legacy chapter content stored on base44 cloud.
      // Browser hits localhost:5180/base44-files/api/apps/... → forwarded to
      // https://base44.app/api/apps/...
      '/base44-files': {
        target: 'https://base44.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/base44-files/, ''),
        secure: true,
      },
      // Proxy media.base44.com CDN — base44 file API often redirects here.
      '/base44-media': {
        target: 'https://media.base44.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/base44-media/, ''),
        secure: true,
      },
    },
  },
})