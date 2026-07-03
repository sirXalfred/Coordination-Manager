/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Use polling for reliable HMR on OneDrive-synced paths
      usePolling: true,
      interval: 500,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Use esbuild for CSS minification. lightningcss (vite 8 default) rejects
    // `@media (min-width: 100%)` which Tailwind emits from our container.screens
    // hack (sm/md/lg/xl=100%). Switching minifiers avoids a churn-y refactor of
    // the breakpoint config.
    cssMinify: 'esbuild',
    rollupOptions: {
      output: {
        // rolldown (vite 8) requires manualChunks to be a function,
        // not an object map. Mirror the previous vendor split.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) {
            return 'vendor-react'
          }
          if (id.includes('@supabase/supabase-js')) {
            return 'vendor-supabase'
          }
          if (/[\\/]node_modules[\\/](date-fns|axios|lucide-react)[\\/]/.test(id)) {
            return 'vendor-utils'
          }
        },
      },
    },
  },
})
