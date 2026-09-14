import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET || 'https://rixeyapp-production.up.railway.app'

// Which build an error came from.
//
// reportError already sends `release: import.meta.env.VITE_COMMIT_SHA`, and
// nothing has ever set it, so every client error in the table says release
// null. A TypeError on 22 August pointed at admin-rBPcJoYO.js, a bundle that
// no longer exists and cannot be mapped back to any line of source. One
// occurrence, and nothing to be done with it.
//
// Vercel exposes the commit as VERCEL_GIT_COMMIT_SHA at build time. Taking it
// here means the next one can at least be pinned to a commit.
const COMMIT =
  process.env.VITE_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  null;

export default defineConfig({
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(COMMIT ? COMMIT.slice(0, 7) : null),
  },
  plugins: [react(), tailwindcss(), visualizer({ gzipSize: true, open: false, filename: './dist/stats.html' })],
  server: {
    proxy: {
      '/api': {
        target: DEV_API_TARGET,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks — loaded once, cached long-term
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-konva': ['konva', 'react-konva'],
        },
      },
    },
  },
})
