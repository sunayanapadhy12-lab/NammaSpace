import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    // Three.js + loaders bundle to ~630 kB minified
    chunkSizeWarningLimit: 750,
  },
})
