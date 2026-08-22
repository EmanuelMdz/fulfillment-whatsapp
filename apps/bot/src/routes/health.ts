import { Hono } from 'hono'
import { loadEnv, hasWhatsapp } from '../config/env.js'

/**
 * Chequeo de salud. Lo usa el hosting para saber si el proceso está vivo
 * y el instalador para confirmar que quedó bien configurado.
 */
export const healthRoute = new Hono()

healthRoute.get('/', (c) => {
  const env = loadEnv()
  return c.json({
    ok: true,
    version: '0.1.0',
    timezone: env.timezone,
    whatsapp: hasWhatsapp(env) ? 'configurado' : 'sin configurar',
  })
})
