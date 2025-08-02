import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    origin: 'https://5173-ig2sggj6lv0cmo03nxz9w-0785015f.manusvm.computer',
    allowedHosts: ['.manusvm.computer']
  }
})


