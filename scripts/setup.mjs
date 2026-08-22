#!/usr/bin/env node
/**
 * Instalador.
 *
 * Objetivo: que alguien que nunca vio este repo pase de clonar a tener el
 * bot contestando en menos de treinta minutos. Cada minuto invertido acá
 * son horas de soporte ahorradas después.
 *
 * ESTADO: hace la parte de configuración. El corredor de migraciones y la
 * creación del usuario dueño llegan en la tanda 2 — están marcados abajo.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stdin, stdout } from 'node:process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const examplePath = join(root, '.env.example')

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const PACKS = ['ecommerce', 'servicios']

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

async function main() {
  console.log('\n  Instalación de Fulfillment WhatsApp\n')

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
    console.log('\n  Los dos valores salen de tu proyecto de Supabase, en')
    console.log('  Configuración → API. Completalos y volvé a correr: npm run setup\n')
    process.exit(1)
  }

  const rl = createInterface({ input: stdin, output: stdout })
  let pack = ''
  while (!PACKS.includes(pack)) {
    pack = (await rl.question(`  ¿Qué pack instalás? (${PACKS.join(' / ')}): `)).trim().toLowerCase()
  }
  await rl.close()

  console.log(`\n  Pack elegido: ${pack}`)
  console.log('\n  Todavía falta implementar (tanda 2):')
  console.log('    - correr packages/db/migrations en orden')
  console.log('    - escribir la configuración del pack desde packages/core')
  console.log('    - sembrar el catálogo de ejemplo')
  console.log('    - crear el usuario dueño')
  console.log('\n  Por ahora aplicá las migraciones a mano desde el editor SQL')
  console.log('  de Supabase, en orden numérico. Después:\n')
  console.log('    npm run build && npm start\n')
}

main().catch((err) => {
  console.error(`\n  ${err.message}\n`)
  process.exit(1)
})
