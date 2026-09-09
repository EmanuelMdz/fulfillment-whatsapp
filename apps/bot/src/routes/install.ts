import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { PACKS } from '@fw/core'
import { loadEnv } from '../config/env.js'
import { forgetSettings } from '../config/settings.js'
import { db } from '../db/client.js'
import { applyPendingMigrations, canAutoMigrate, closeSignups, pendingMigrations, sqlBundle } from '../db/migrate.js'
import { appliedMigrations, getConfig } from '../db/queries.js'
import { describe } from '../utils/errors.js'

/**
 * El asistente de instalación.
 *
 * Objetivo: que alguien que nunca vio el repo pase de "desplegué en
 * Railway" a "el bot me contesta" sin abrir una terminal.
 *
 * Con el token de acceso (lo normal), las tablas ya se crearon al
 * arrancar el servidor (ver index.ts) y acá solo queda el negocio y el
 * usuario. Sin token, el panel muestra el SQL y el dueño lo pega en el
 * editor de Supabase: un solo paste.
 *
 * Estas rutas son públicas (todavía no hay usuario), así que se
 * protegen solas:
 *   - /status y /sql no revelan nada que no esté en el repo.
 *   - /finish exige que NO haya usuarios todavía, y una prueba de que
 *     quien instala es el dueño: con token, los últimos caracteres del
 *     token (que él cargó en el hosting); sin token, el código que viajó
 *     adentro del SQL que pegó en su base.
 *
 * Después de instalado, /sql y /migrate siguen sirviendo para las
 * actualizaciones (con sesión, desde /api/panel/migrate).
 */
export const installRoute = new Hono()

async function hayUsuarios(): Promise<boolean> {
  const { data, error } = await db().from('team_members').select('email').eq('role', 'owner').limit(1)
  if (error && ['42P01', 'PGRST205'].includes(error.code)) return false
  if (error) throw error
  return Boolean(data?.length)
}

export async function installStatus(): Promise<{
  dbReady: boolean
  pending: string[]
  installed: boolean
  auto: boolean
  detail?: string
}> {
  const { dbReady, pending } = await pendingMigrations()
  let installed = false
  let detail: string | undefined
  try {
    installed = await hayUsuarios()
  } catch (err) {
    detail = `No se pudo consultar el equipo en Supabase: ${describe(err)}`
  }
  return { dbReady, pending, installed, auto: canAutoMigrate(), detail }
}

installRoute.get('/status', async (c) => c.json(await installStatus()))

installRoute.get('/sql', async (c) => {
  const st = await installStatus()
  let sql = sqlBundle(st.pending)
  let token: string | null = null
  if (!st.installed) {
    token = randomBytes(16).toString('hex')
    sql += [
      '',
      '',
      '-- Prueba de que quien instala tiene acceso a esta base (se borra al terminar).',
      `update public.app_config set install_token = '${token}' where id = 1;`,
      '',
    ].join('\n')
  }
  return c.json({ sql, token, pending: st.pending, installed: st.installed })
})

// Con token de acceso: aplica lo pendiente ahora. Antes de instalar es
// público (no hay usuario); después, la misma acción vive en
// /api/panel/migrate, con sesión.
installRoute.post('/migrate', async (c) => {
  if (!canAutoMigrate()) {
    return c.json({ error: 'Sin SUPABASE_ACCESS_TOKEN el servidor no puede crear tablas: pegá el SQL' }, 400)
  }
  if (await hayUsuarios()) {
    return c.json({ error: 'Ya instalado: aplicá las actualizaciones desde el panel' }, 409)
  }
  try {
    const aplicadas = await applyPendingMigrations()
    return c.json({ ok: true, aplicadas })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})

// Una sola réplica es un requisito del producto. Dos clics en el asistente
// no pueden crear usuarios en paralelo mientras termina la primera petición.
let finishing = false
installRoute.use('/finish', async (c, next) => {
  if (finishing) return c.json({ error: 'La instalación está en curso. Esperá y verificá el estado.' }, 409)
  finishing = true
  try { await next() } finally { finishing = false }
})

installRoute.post('/finish', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ error: 'JSON inválido' }, 400)

  const st = await installStatus()
  if (st.detail) return c.json({ error: st.detail }, 502)
  if (st.pending.length) {
    return c.json({ error: 'Todavía faltan migraciones. Verificá la base de nuevo.' }, 409)
  }
  if (st.installed) {
    return c.json({ error: 'Esta instalación ya tiene usuarios. Entrá con el tuyo.' }, 409)
  }

  // La prueba de que es el dueño.
  const { accessToken } = loadEnv().supabase
  if (accessToken) {
    const cola = typeof body.tokenTail === 'string' ? body.tokenTail.trim() : ''
    if (!cola || cola !== accessToken.slice(-8)) {
      return c.json(
        { error: 'Los últimos 8 caracteres no coinciden con el token de acceso cargado en el hosting.' },
        403,
      )
    }
  } else {
    const config = await getConfig()
    const token = typeof body.token === 'string' ? body.token : ''
    if (!config.install_token || token !== config.install_token) {
      return c.json(
        { error: 'El código de instalación no coincide con el de la base. Pegá el SQL de nuevo y volvé a intentar.' },
        403,
      )
    }
  }

  const pack = 'agent'
  if (body.pack !== undefined && body.pack !== pack) {
    return c.json({ error: 'La instalación inicial es un agente genérico. Recargá el asistente.' }, 400)
  }
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
  if (!businessName) return c.json({ error: 'Falta el nombre del negocio' }, 400)
  const email = typeof body.ownerEmail === 'string' ? body.ownerEmail.trim().toLowerCase() : ''
  const password = typeof body.ownerPassword === 'string' ? body.ownerPassword : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Email inválido' }, 400)
  if (password.length < 8) return c.json({ error: 'La contraseña tiene que tener al menos 8 caracteres' }, 400)

  let timezone = typeof body.timezone === 'string' ? body.timezone : 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
  } catch {
    timezone = 'UTC'
  }
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : '$'

  const def = PACKS[pack]
  let createdUserId: string | null = null
  try {
    // Si el proceso murió después de crear Auth y antes del RPC, el dueño
    // (ya validado por el token) puede retomar con el mismo correo.
    const created = await db().auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) {
      if (!['email_exists', 'email_conflict', 'user_already_exists'].includes(created.error.code ?? '')) throw created.error
      let existingId: string | undefined
      for (let page = 1; ; page++) {
        const users = await db().auth.admin.listUsers({ page, perPage: 100 })
        if (users.error) throw users.error
        existingId = users.data.users.find((u) => u.email?.toLowerCase() === email)?.id
        if (existingId || users.data.users.length < 100) break
      }
      if (!existingId) throw created.error
      const reset = await db().auth.admin.updateUserById(existingId, { password, email_confirm: true })
      if (reset.error) throw reset.error
      createdUserId = existingId
    } else {
      createdUserId = created.data.user.id
    }

    const finished = await db().rpc('finish_installation', {
      owner_id: createdUserId,
      settings: {
        pack,
        labels: def.labels,
        order_stages: def.stages,
        escalation_reasons: def.reasons,
        business_name: businessName,
        timezone,
        currency,
      },
      module_rows: [],
      catalog_rows: [],
    })
    if (finished.error) throw finished.error

    // 5. Con token: se cierran los registros abiertos. Si falla, no es
    // grave (la base igual no le muestra nada a quien no es del equipo),
    // pero queda en el registro.
    let signupsCerrados = false
    try {
      signupsCerrados = await closeSignups()
    } catch (err) {
      console.warn('[instalar] no se pudieron cerrar los registros de Auth:', describe(err))
    }

    forgetSettings()
    return c.json({ ok: true, signupsCerrados })
  } catch (err) {
    // No borrar Auth acá: un timeout puede ocurrir DESPUÉS del commit del
    // RPC. Conservarlo permite verificar el estado y reintentar sin dejar
    // una membresía apuntando a un usuario que ya no existe.
    return c.json({ error: describe(err) }, 502)
  }
})

// Se re-exporta para que el arranque pueda leer el estado sin pasar por HTTP.
export { appliedMigrations }
