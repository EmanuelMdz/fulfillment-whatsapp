/**
 * Punto de entrada. Un solo proceso hace todo:
 *
 *   1. sirve el panel ya compilado (apps/panel → apps/bot/public)
 *   2. recibe el webhook de WhatsApp
 *   3. expone la API que consume el panel
 *   4. corre los crons (seguimientos, vigilancia de sesión, resumen diario)
 *
 * Por eso NO puede correr en funciones serverless: necesita proceso vivo.
 * Ver docs/DECISIONES.md.
 */

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv, hasWhatsapp } from './config/env.js'
import { healthRoute } from './routes/health.js'

const env = loadEnv()
const app = new Hono()

// serveStatic resuelve las rutas contra el directorio donde se ejecutó el
// proceso, no contra este archivo. Calculamos la ruta al panel a partir del
// módulo para que el servidor arranque igual desde cualquier lado.
const panelDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const panelRoot = relative(process.cwd(), panelDir).split('\\').join('/')
const hasPanel = existsSync(panelDir)

// ── API ───────────────────────────────────────────────────────
app.route('/health', healthRoute)

// TODO tanda 1: webhook de WhatsApp
// TODO tanda 1: rutas de la API del panel
// TODO tanda 2: sesión y QR

// ── Panel ─────────────────────────────────────────────────────
// Todo lo que no sea API sale del panel compilado. El comodín al final
// devuelve index.html para que las rutas del panel funcionen al recargar.
if (hasPanel) {
  app.use('/*', serveStatic({ root: panelRoot }))
  app.get('*', serveStatic({ path: `${panelRoot}/index.html` }))
} else {
  app.get('*', (c) => c.text('El panel no está compilado todavía. Corré: npm run build', 503))
}

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[fw] escuchando en http://localhost:${info.port}`)
  console.log(`[fw] zona horaria: ${env.timezone}`)
  if (!hasPanel) {
    console.log('[fw] panel sin compilar — corré npm run build')
  }
  if (!hasWhatsapp(env)) {
    console.log('[fw] WhatsApp sin configurar — conectá el número desde el panel')
  }
})
