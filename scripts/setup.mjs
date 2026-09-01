#!/usr/bin/env node
/**
 * Instalador.
 *
 * Objetivo: que alguien que nunca vio este repo pase de clonar a tener el
 * bot contestando en menos de treinta minutos. Cada minuto invertido acá
 * son horas de soporte ahorradas después.
 *
 * Qué hace, en orden:
 *   1. Revisa el .env (lo crea desde .env.example si no está).
 *   2. Corre las migraciones que falten, en orden, cada una en su
 *      transacción (tabla _migrations como registro).
 *   3. Escribe la configuración del pack elegido (diccionario, estados,
 *      motivos, módulos) leyendo packages/core — una sola fuente.
 *   4. Siembra el catálogo de ejemplo, si querés.
 *   5. Crea el usuario dueño para entrar al panel.
 *
 * Es seguro correrlo dos veces: las migraciones aplicadas se saltean y
 * las siembras no pisan lo que ya exista.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stdin, stdout } from 'node:process'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { PACKS as PACK_DEFS, MODULES, modulesForPack } from '../packages/core/src/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const examplePath = join(root, '.env.example')
const migrationsDir = join(root, 'packages', 'db', 'migrations')
const seedsDir = join(root, 'packages', 'db', 'seeds')

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const PACK_NAMES = Object.keys(PACK_DEFS)

function parseEnv(text) {
  const out = {}
  for (const line of text.split('\n')) {
    const clean = line.trim()
    if (!clean || clean.startsWith('#')) continue
    const eq = clean.indexOf('=')
    if (eq === -1) continue
    out[clean.slice(0, eq)] = clean.slice(eq + 1)
  }
  return out
}

async function runMigrations(dbUrl) {
  const client = new pg.Client({
    connectionString: dbUrl,
    // Supabase exige TLS; el certificado del pooler no siempre valida
    // contra el store local de Node, y para una conexión de instalación
    // alcanza con el cifrado.
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query(
      'create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())',
    )
    const done = new Set(
      (await client.query('select name from public._migrations')).rows.map((r) => r.name),
    )
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

    let aplicadas = 0
    for (const file of files) {
      if (done.has(file)) continue
      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      try {
        await client.query('begin')
        await client.query(sql)
        await client.query('insert into public._migrations (name) values ($1)', [file])
        await client.query('commit')
        console.log(`    aplicada: ${file}`)
        aplicadas++
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw new Error(`La migración ${file} falló: ${err.message}`)
      }
    }
    if (!aplicadas) console.log('    nada nuevo: la base ya estaba al día')
    return client
  } catch (err) {
    await client.end().catch(() => {})
    throw err
  }
}

async function main() {
  console.log('\n  Instalación de Fulfillment WhatsApp\n')

  // ── 1. El .env ──────────────────────────────────────────────
  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) {
      console.error('  No encuentro .env.example. ¿Estás parado en la raíz del repo?')
      process.exit(1)
    }
    writeFileSync(envPath, readFileSync(examplePath, 'utf8'))
    console.log('  Creé el archivo .env a partir de .env.example.')
  }

  const env = parseEnv(readFileSync(envPath, 'utf8'))
  const faltan = REQUIRED.filter((k) => !env[k])
  if (faltan.length) {
    console.log('\n  Falta completar en .env:\n')
    for (const k of faltan) console.log(`    ${k}`)
    console.log('\n  Salen de tu proyecto de Supabase, en Configuración → API.')
    console.log('  Completalos y volvé a correr: npm run setup\n')
    process.exit(1)
  }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.log('  AVISO: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY —')
    console.log('  sin ellas el panel no puede loguear. Completalas antes del build.\n')
  }

  const rl = createInterface({ input: stdin, output: stdout })

  // ── 2. Conexión directa a la base (para las migraciones) ────
  let dbUrl = env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.log('  Para correr las migraciones necesito la conexión directa a Postgres.')
    console.log('  En Supabase: botón "Connect" arriba → "Session pooler" → copiá la URI')
    console.log('  (empieza con postgresql:// y lleva tu contraseña de base).\n')
    dbUrl = (await rl.question('  Pegala acá: ')).trim()
    if (!dbUrl.startsWith('postgres')) {
      console.error('\n  Eso no parece una URI de Postgres. Probá de nuevo.\n')
      process.exit(1)
    }
    appendFileSync(envPath, `\n# Conexion directa (solo la usa el instalador)\nSUPABASE_DB_URL=${dbUrl}\n`)
    console.log('  La guardé en el .env para la próxima.\n')
  }

  // ── 3. Preguntas ────────────────────────────────────────────
  let pack = ''
  while (!PACK_NAMES.includes(pack)) {
    pack = (await rl.question(`  ¿Qué pack instalás? (${PACK_NAMES.join(' / ')}): `)).trim().toLowerCase()
  }
  const sembrarDemo = (await rl.question('  ¿Sembrar catálogo de ejemplo? (s/n): ')).trim().toLowerCase().startsWith('s')
  console.log('\n  El usuario dueño es con el que vas a entrar al panel.')
  const ownerEmail = (await rl.question('  Email del dueño (vacío para saltear): ')).trim()
  let ownerPassword = ''
  if (ownerEmail) {
    while (ownerPassword.length < 8) {
      ownerPassword = (await rl.question('  Contraseña (mínimo 8): ')).trim()
    }
  }
  await rl.close()

  // ── 4. Migraciones ──────────────────────────────────────────
  console.log('\n  Migraciones:')
  const client = await runMigrations(dbUrl)

  // ── 5. Configuración del pack (una sola fuente: packages/core) ──
  console.log('\n  Configuración del pack:')
  const def = PACK_DEFS[pack]
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const configRes = await db
    .from('app_config')
    .update({
      pack,
      labels: def.labels,
      order_stages: def.stages,
      escalation_reasons: def.reasons,
      timezone: env.TIMEZONE || 'America/Montevideo',
      notify_chat_id: env.NOTIFY_CHAT_ID || null,
    })
    .eq('id', 1)
  if (configRes.error) throw new Error(`No pude escribir app_config: ${configRes.error.message}`)
  console.log(`    pack "${def.label}": diccionario, ${def.stages.length} estados, ${def.reasons.length} motivos`)

  const prendidos = modulesForPack(pack)
  const modulesRes = await db.from('modules').upsert(
    MODULES.map((m) => ({ key: m.key, enabled: prendidos.includes(m.key) })),
    { onConflict: 'key' },
  )
  if (modulesRes.error) throw new Error(`No pude escribir modules: ${modulesRes.error.message}`)
  console.log(`    módulos prendidos: ${prendidos.join(', ') || 'ninguno'}`)

  // ── 6. Catálogo de ejemplo ──────────────────────────────────
  if (sembrarDemo) {
    const seedFile = join(seedsDir, `demo-${pack}.sql`)
    if (existsSync(seedFile)) {
      await client.query(readFileSync(seedFile, 'utf8'))
      console.log('    catálogo de ejemplo sembrado (se borra sin miedo)')
    }
  }
  await client.end()

  // ── 7. Usuario dueño ────────────────────────────────────────
  if (ownerEmail) {
    const { error } = await db.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    })
    if (error) {
      if (/already/i.test(error.message)) {
        console.log(`\n  El usuario ${ownerEmail} ya existía — sigue valiendo el que está.`)
      } else {
        throw new Error(`No pude crear el usuario: ${error.message}`)
      }
    } else {
      console.log(`\n  Usuario dueño creado: ${ownerEmail}`)
    }
  }

  // ── Listo ───────────────────────────────────────────────────
  console.log('\n  Instalación lista. Lo que sigue:\n')
  console.log('    1. npm run build   (compila el panel adentro del servidor)')
  console.log('    2. npm start       (o npm run dev para desarrollo)')
  console.log('    3. Entrá al panel, pestaña Conexión, y escaneá el QR')
  console.log('       con el número DEDICADO del negocio.\n')
  console.log('  Para ponerlo en línea, seguí docs/DEPLOY.md (Railway).\n')
}

main().catch((err) => {
  console.error(`\n  ${err.message}\n`)
  process.exit(1)
})
