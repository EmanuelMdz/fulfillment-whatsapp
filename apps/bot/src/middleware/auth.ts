import type { MiddlewareHandler } from 'hono'
import { createHash } from 'node:crypto'
import { db } from '../db/client.js'
import { isTeamMember } from '../db/queries.js'

/**
 * Auth de las rutas del panel (`/api/panel/*`).
 *
 * El panel manda el access_token de la sesión de Supabase del usuario
 * logueado, y el servidor lo valida contra Supabase Auth. Así no hace
 * falta NINGUNA clave compartida viajando al navegador: quien puede
 * entrar al panel, puede usar la API — y nadie más.
 *
 * Dos chequeos, no uno: que el token sea válido, y que el email esté en
 * `team_members`. Registrarse en Supabase está abierto por defecto, así
 * que "tener usuario" no alcanza: hay que ser del equipo. La base aplica
 * la misma regla en sus policies (ver 0008_equipo.sql).
 */

/** Lo que las rutas del panel pueden leer del usuario que llama. */
export type PanelEnv = { Variables: { userEmail: string } }

// Validar contra Supabase es un viaje de red por request; el panel
// consulta seguido (lista + hilo + estado de sesión). El cache recuerda
// los tokens ya validados por un minuto.
const TOKEN_CACHE_TTL_MS = 60_000
const TOKEN_CACHE_MAX = 500
const tokenCache = new Map<string, { vence: number; email: string }>() // sha256(jwt) → …

export const requirePanelUser: MiddlewareHandler<PanelEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Falta el header Authorization: Bearer <access_token>' }, 401)
  }
  const token = authHeader.slice(7)

  // Un JWT tiene tres partes. Cualquier otra cosa ni se consulta.
  if (token.split('.').length !== 3) return c.json({ error: 'Credenciales inválidas' }, 401)

  const cacheKey = createHash('sha256').update(token).digest('hex')
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.vence > Date.now()) {
    c.set('userEmail', cached.email)
    await next()
    return
  }

  const { data, error } = await db().auth.getUser(token)
  const email = data?.user?.email?.toLowerCase()
  if (error || !email) return c.json({ error: 'Credenciales inválidas' }, 401)

  if (!(await isTeamMember(email))) {
    return c.json({ error: 'Tu usuario no es del equipo de este negocio' }, 403)
  }

  if (tokenCache.size >= TOKEN_CACHE_MAX) tokenCache.clear()
  tokenCache.set(cacheKey, { vence: Date.now() + TOKEN_CACHE_TTL_MS, email })
  c.set('userEmail', email)
  await next()
}
