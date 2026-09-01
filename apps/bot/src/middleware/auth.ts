import type { MiddlewareHandler } from 'hono'
import { createHash } from 'node:crypto'
import { db } from '../db/client.js'

/**
 * Auth de las rutas del panel (`/api/panel/*`).
 *
 * El panel manda el access_token de la sesión de Supabase del usuario
 * logueado, y el servidor lo valida contra Supabase Auth. Así no hace
 * falta NINGUNA clave compartida viajando al navegador: quien puede
 * entrar al panel, puede usar la API — y nadie más.
 *
 * Una instalación es un negocio (ver docs/DECISIONES.md): cualquier
 * usuario de Auth de este proyecto ES del equipo. Si algún día hacen
 * falta roles, el lugar es este middleware y las policies de la base.
 */

// Validar contra Supabase es un viaje de red por request; el panel
// consulta seguido (lista + hilo + estado de sesión). El cache recuerda
// los tokens ya validados por un minuto.
const TOKEN_CACHE_TTL_MS = 60_000
const TOKEN_CACHE_MAX = 500
const tokenCache = new Map<string, number>() // sha256(jwt) → vence (epoch ms)

export const requirePanelUser: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Falta el header Authorization: Bearer <access_token>' }, 401)
  }
  const token = authHeader.slice(7)

  // Un JWT tiene tres partes. Cualquier otra cosa ni se consulta.
  if (token.split('.').length !== 3) return c.json({ error: 'Credenciales inválidas' }, 401)

  const cacheKey = createHash('sha256').update(token).digest('hex')
  const cached = tokenCache.get(cacheKey)
  if (cached && cached > Date.now()) {
    await next()
    return
  }

  const { data, error } = await db().auth.getUser(token)
  if (error || !data?.user) return c.json({ error: 'Credenciales inválidas' }, 401)

  if (tokenCache.size >= TOKEN_CACHE_MAX) tokenCache.clear()
  tokenCache.set(cacheKey, Date.now() + TOKEN_CACHE_TTL_MS)
  await next()
}
