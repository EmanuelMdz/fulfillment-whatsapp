import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODULES, PACKS, SEEDS, modulesForPack } from '@fw/core'
import { forgetSettings } from '../config/settings.js'
import { db } from '../db/client.js'
import { addTeamMember, appliedMigrations, getConfig, updateConfig } from '../db/queries.js'
import { describe } from '../utils/errors.js'

/**
 * El asistente de instalación.
 *
 * Objetivo: que alguien que nunca vio el repo pase de "desplegué en
 * Railway" a "el bot me contesta" sin abrir una terminal. El servidor,
 * con la clave de servicio, puede hacer casi todo: escribir la
 * configuración del pack, sembrar el catálogo, crear el usuario dueño.
 * Lo ÚNICO que no puede hacer por la API de Supabase es crear tablas.
 * Para eso el panel le muestra al dueño el SQL y él lo pega en el editor
 * de Supabase: un solo paste.
 *
 * Estas rutas son públicas (todavía no hay usuario), así que se
 * protegen solas:
 *   - /status y /sql no revelan nada que no esté en el repo.
 *   - /finish exige dos cosas: que NO haya usuarios todavía, y el token
 *     que viajó adentro del SQL. Quien no pegó ese SQL en esa base no
 *     tiene el token — y eso prueba que es el dueño de la base.
 *
 * Después de instalado, /sql sigue sirviendo para las actualizaciones:
 * cuando un push trae una migración nueva, el panel avisa y da el SQL.
 */
export const installRoute = new Hono()

// apps/bot/src/routes → la raíz del repo está cuatro niveles arriba. En
// dist/routes es la misma distancia.
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..',
  'packages', 'db', 'migrations',
)

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

async function hayUsuarios(): Promise<boolean> {
  const { data, error } = await db().auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) throw error
  return (data?.users?.length ?? 0) > 0
}

async function estado(): Promise<{ dbReady: boolean; pending: string[]; installed: boolean; detail?: string }> {
  const aplicadas = await appliedMigrations()
  const archivos = migrationFiles()
  const pending = aplicadas === null ? archivos : archivos.filter((f) => !aplicadas.includes(f))
  let installed = false
  let detail: string | undefined
  try {
    installed = await hayUsuarios()
  } catch (err) {
    detail = `No se pudo consultar Supabase Auth: ${describe(err)}`
  }
  return { dbReady: aplicadas !== null, pending, installed, detail }
}

installRoute.get('/status', async (c) => c.json(await estado()))

installRoute.get('/sql', async (c) => {
  const st = await estado()
  const partes: string[] = [
    '-- Fulfillment WhatsApp — pegá TODO esto en Supabase → SQL Editor → Run.',
    '-- Se puede pegar más de una vez sin romper nada.',
    'create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now());',
  ]
  for (const file of st.pending) {
    partes.push(`-- >>> ${file}`)
    partes.push(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    partes.push(`insert into public._migrations (name) values ('${file}') on conflict do nothing;`)
  }

  let token: string | null = null
  if (!st.installed) {
    token = randomBytes(16).toString('hex')
    partes.push('-- Prueba de que quien instala tiene acceso a esta base (se borra al terminar).')
    partes.push(`update public.app_config set install_token = '${token}' where id = 1;`)
  }

  return c.json({ sql: partes.join('\n\n') + '\n', token, pending: st.pending, installed: st.installed })
})

installRoute.post('/finish', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  const st = await estado()
  if (st.pending.length) {
    return c.json({ error: 'Todavía faltan migraciones: pegá el SQL en Supabase y verificá de nuevo' }, 409)
  }
  if (st.installed) {
    return c.json({ error: 'Esta instalación ya tiene usuarios. Entrá con el tuyo.' }, 409)
  }

  const config = await getConfig()
  const token = typeof body.token === 'string' ? body.token : ''
  if (!config.install_token || token !== config.install_token) {
    return c.json(
      { error: 'El código de instalación no coincide con el de la base. Pegá el SQL de nuevo y volvé a intentar.' },
      403,
    )
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

    forgetSettings()
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})
