// vite.config.js — FULL REPLACEMENT
// Removes @base44/vite-plugin. Adds path alias for @/ imports.

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  logLevel: 'error',
  plugins: [
    react(),
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
    port: 5180,
    strictPort: true,
    proxy: {
      // Proxy ComfyUI API requests to avoid CORS in browser
      // Browser hits localhost:5180/comfyui-api/... → forwarded to 127.0.0.1:8000/...
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