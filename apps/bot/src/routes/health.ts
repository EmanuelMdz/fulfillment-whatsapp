import { Hono } from 'hono'
import { getSettings, hasLlm, hasWhatsapp } from '../config/settings.js'
import { describe } from '../utils/errors.js'

/**
 * Chequeo de salud. Lo usa el hosting para saber si el proceso está vivo,
 * y el panel para mostrar la franja de "falta configurar tal cosa".
 *
 * Responde ok:true aunque la base no conteste o no esté instalada: el
 * proceso ESTÁ vivo, y si el hosting lo reiniciara por esto, el asistente
 * de instalación nunca llegaría a abrirse.
 */
export const healthRoute = new Hono()

const VERSION = '0.2.0'

healthRoute.get('/', async (c) => {
  try {
    const s = await getSettings()
    return c.json({
      ok: true,
      version: VERSION,
      timezone: s.config.timezone,
      whatsapp: hasWhatsapp(s) ? 'configurado' : 'sin configurar',
      // Lo que vio el vigilante la última vez (ver workers/session-watch.ts).
      // 'WORKING' es el único que significa "el bot está atendiendo".
      session: s.config.whatsapp_status ?? null,
      session_at: s.config.whatsapp_status_at ?? null,
      llm: hasLlm(s) ? 'configurado' : 'sin clave',
      public_url: s.publicUrl || null,
    })
  } catch (err) {
    return c.json({ ok: true, version: VERSION, db: `sin instalar o sin conexión: ${describe(err)}` })
  }
})
