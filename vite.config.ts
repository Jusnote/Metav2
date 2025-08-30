import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lexical-playground': path.resolve(__dirname, './src/components/lexical-playground'),
      '@lexical-shared': path.resolve(__dirname, './src/components/lexical-playground/shared/src'),
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  server: {
    host: true,
    port: 5173,
    origin: 'https://5173-ig2sggj6lv0cmo03nxz9w-0785015f.manusvm.computer',
    allowedHosts: ['.manusvm.computer']
  }
})


