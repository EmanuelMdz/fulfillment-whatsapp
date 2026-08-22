import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * El panel se compila DENTRO del servidor (apps/bot/public). Por eso el
 * producto es un solo deploy: no hay dos servicios que sincronizar ni CORS
 * que configurar. Ver docs/DECISIONES.md.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../bot/public',
    emptyOutDir: true,
  },
  server: {
    // En desarrollo el panel corre aparte y manda la API al servidor.
    proxy: {
      '/health': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
})
