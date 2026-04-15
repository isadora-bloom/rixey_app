import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const DEV_API_TARGET = process.env.VITE_DEV_API_TARGET || 'https://rixeyapp-production.up.railway.app'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
          // Admin is the heaviest page — split it for faster initial load
          'admin': [
            './src/pages/Admin.jsx',
            './src/pages/admin/AdminWeddingProfile.jsx',
            './src/pages/admin/AdminWeddingList.jsx',
            './src/pages/admin/AdminHeader.jsx',
            './src/pages/admin/DirectMessagesPanel.jsx',
          ],
        },
      },
    },
  },
})
