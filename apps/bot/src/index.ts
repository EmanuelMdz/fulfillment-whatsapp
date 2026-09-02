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
import { initEnv } from './config/env.js'
import { getSettings, hasLlm, hasWhatsapp } from './config/settings.js'
import { applyPendingMigrations, canAutoMigrate } from './db/migrate.js'
import { recoverUnansweredTurns } from './db/queries.js'
import { requirePanelUser } from './middleware/auth.js'
import { healthRoute } from './routes/health.js'
import { installRoute } from './routes/install.js'
import { panelRoute } from './routes/panel.js'
import { webhookRoute } from './routes/webhook.js'
import { describe } from './utils/errors.js'
import { startFollowups } from './workers/followups.js'
import { startSendQueue } from './workers/send-queue.js'
import { startTurns } from './workers/turns.js'

// Con el token de acceso, esto le pide las claves del proyecto a
// Supabase; por eso es async y se espera antes de levantar nada.
const env = await initEnv()

// La base al día ANTES de atender: con el token, las tablas que falten
// se crean acá (primera instalación o una actualización que trajo una
// migración nueva). Sin token, el asistente del panel muestra el SQL.
if (canAutoMigrate()) {
  try {
    const aplicadas = await applyPendingMigrations()
    if (aplicadas.length) console.log(`[base] migraciones aplicadas: ${aplicadas.join(', ')}`)
    else console.log('[base] al día')
  } catch (err) {
    console.error(`[base] no se pudieron aplicar las migraciones: ${describe(err)}`)
  }
}

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
// El asistente de instalación es público: todavía no hay usuario. Sus
// rutas se protegen solas (ver routes/install.ts).
app.route('/api/install', installRoute)
app.use('/api/panel/*', requirePanelUser)
app.route('/api/panel', panelRoute)

// ── Config pública del panel ──────────────────────────────────
// La URL y la clave pública de Supabase las sirve el servidor en tiempo
// de ejecución, no se hornean en el build. Así un mismo build anda en
// cualquier instalación, y el alumno no tiene que recompilar nada. La
// clave anon es pública por diseño: la protección son las policies.
app.get('/config.js', (c) => {
  const cfg = JSON.stringify({
    supabaseUrl: env.supabase.url,
    supabaseAnonKey: env.supabase.anonKey,
  })
  return c.body(`window.__FW__ = ${cfg};`, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store',
  })
})

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
  if (!hasPanel) {
    console.log('[fw] panel sin compilar — corré npm run build')
  }

  // Lo que sigue lee la base. Si no está instalada, el asistente del
  // panel se encarga: el servidor arranca igual.
  void (async () => {
    try {
      const s = await getSettings()
      console.log(`[fw] zona horaria: ${s.config.timezone}`)
      if (!hasWhatsapp(s)) console.log('[fw] WhatsApp sin configurar — panel → Conexión')
      if (!hasLlm(s)) console.log('[fw] modelo de IA sin clave — panel → Studio')

      // El turno que estaba corriendo cuando murió el proceso anterior
      // (un redeploy en el peor momento) vuelve a la cola. Ver 0009.
      const recuperados = await recoverUnansweredTurns()
      if (recuperados) {
        console.log(`[turno] ${recuperados} conversación(es) sin responder recuperadas del arranque anterior`)
      }
    } catch (err) {
      console.log(`[fw] base sin instalar o sin conexión — abrí el panel para instalar (${describe(err)})`)
    }
  })()
})
