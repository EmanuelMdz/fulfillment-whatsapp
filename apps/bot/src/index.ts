/**
 * Punto de entrada. Un solo proceso hace todo:
 *
 *   1. sirve el panel ya compilado (apps/panel → apps/bot/public)
 *   2. recibe el webhook de WhatsApp
 *   3. vacía la cola de envío, de a uno y con pausas
 *   4. contesta los turnos que vencieron
 *
 * Por eso NO puede correr en funciones serverless, y por eso va con UNA
 * sola réplica: dos procesos son dos colas mandando en paralelo, y ahí se
 * pierde la protección del número. Ver docs/DECISIONES.md y docs/DEPLOY.md.
 */

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv, hasWhatsapp } from './config/env.js'
import { requirePanelUser } from './middleware/auth.js'
import { healthRoute } from './routes/health.js'
import { panelRoute } from './routes/panel.js'
import { webhookRoute } from './routes/webhook.js'
import { startFollowups } from './workers/followups.js'
import { startSendQueue } from './workers/send-queue.js'
import { startTurns } from './workers/turns.js'

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
app.route('/webhook/whatsapp', webhookRoute)
app.use('/api/panel/*', requirePanelUser)
app.route('/api/panel', panelRoute)

// ── Panel ─────────────────────────────────────────────────────
// Todo lo que no sea API sale del panel compilado. El comodín al final
// devuelve index.html para que las rutas del panel funcionen al recargar.
if (hasPanel) {
  app.use('/*', serveStatic({ root: panelRoot }))
  app.get('*', serveStatic({ path: `${panelRoot}/index.html` }))
} else {
  app.get('*', (c) => c.text('El panel no está compilado todavía. Corré: npm run build', 503))
}

// ── Trabajadores ──────────────────────────────────────────────
startSendQueue()
startTurns()
startFollowups()

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
