import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * El panel se compila DENTRO del servidor (apps/bot/public). Por eso el
 * producto es un solo deploy: no hay dos servicios que sincronizar ni CORS
 * que configurar. Ver docs/DECISIONES.md.
 *
 * Tailwind 4 entra como plugin de Vite: los tokens del diseño (colores,
 * radios, sombras, tipografía) viven en src/styles.css, en un solo lugar.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../bot/public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Las librerías grandes en sus propios archivos: el navegador las
        // cachea entre deploys y el código del panel queda chico.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    // En desarrollo el panel corre aparte y manda la API al servidor.
    proxy: {
      '/health': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      // La config pública (URL y clave anon de Supabase) también la da el servidor.
      '/config.js': 'http://localhost:3000',
    },
  },
})
