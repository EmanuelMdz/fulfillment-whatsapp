import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { MODULES, PACKS, SEEDS, modulesForPack } from '@fw/core'
import { loadEnv } from '../config/env.js'
import { forgetSettings } from '../config/settings.js'
import { db } from '../db/client.js'
import { applyPendingMigrations, canAutoMigrate, closeSignups, pendingMigrations, sqlBundle } from '../db/migrate.js'
import { addTeamMember, appliedMigrations, getConfig, updateConfig } from '../db/queries.js'
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
  const { data, error } = await db().auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) throw error
  return (data?.users?.length ?? 0) > 0
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
    detail = `No se pudo consultar Supabase Auth: ${describe(err)}`
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
  if (await hayUsuarios().catch(() => false)) {
    return c.json({ error: 'Ya instalado: aplicá las actualizaciones desde el panel' }, 409)
  }
  try {
    const aplicadas = await applyPendingMigrations()
    return c.json({ ok: true, aplicadas })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})

installRoute.post('/finish', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const st = await installStatus()
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

  const pack = typeof body.pack === 'string' && body.pack in PACKS ? body.pack : null
  if (!pack) return c.json({ error: `Elegí un pack: ${Object.keys(PACKS).join(' / ')}` }, 400)
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
  try {
    // 1. La configuración del pack: una sola fuente, packages/core.
    await updateConfig({
      pack,
      labels: def.labels,
      order_stages: def.stages,
      escalation_reasons: def.reasons,
      business_name: businessName,
      timezone,
      currency,
      install_token: null,
      installed_at: new Date().toISOString(),
    })

    // 2. Los módulos que ese pack prende.
    const prendidos = modulesForPack(pack)
    const modulesRes = await db()
      .from('modules')
      .upsert(
        MODULES.map((m) => ({ key: m.key, enabled: prendidos.includes(m.key) })),
        { onConflict: 'key' },
      )
    if (modulesRes.error) throw modulesRes.error

    // 3. Catálogo de ejemplo, para que el bot tenga de qué hablar hoy.
    if (body.seedDemo) {
      const filas = SEEDS[pack] ?? []
      if (filas.length) {
        const seedRes = await db().from('catalog_items').insert(filas)
        if (seedRes.error) throw seedRes.error
      }
    }

    // 4. El dueño: usuario en Auth + fila en el equipo.
    const { error } = await db().auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    await addTeamMember(email, 'owner')

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
    return c.json({ error: describe(err) }, 502)
  }
})

// Se re-exporta para que el arranque pueda leer el estado sin pasar por HTTP.
export { appliedMigrations }
