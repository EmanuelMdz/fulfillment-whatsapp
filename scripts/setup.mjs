#!/usr/bin/env node
/**
 * Arranque en tu computadora.
 *
 * La instalación de verdad la hace el panel: cuando el servidor arranca
 * contra una base vacía, muestra un asistente que te lleva a pegar el SQL
 * en Supabase, elegir el pack y crear tu usuario. No hace falta terminal
 * ni la contraseña de Postgres. Ver apps/bot/src/routes/install.ts.
 *
 * Este script solo hace lo que el panel no puede: dejar listo el .env
 * local con las dos variables de Supabase, y decirte qué sigue.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stdin, stdout } from 'node:process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const examplePath = join(root, '.env.example')

const VARIABLES = [
  ['SUPABASE_URL', 'Settings → API → Project URL'],
  ['SUPABASE_ACCESS_TOKEN', 'Account → Access Tokens → Generate new token, empieza con sbp_'],
]

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
  console.log('\n  Fulfillment WhatsApp — arranque local\n')

  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) {
      console.error('  No encuentro .env.example. ¿Estás parado en la raíz del repo?')
      process.exit(1)
    }
    writeFileSync(envPath, readFileSync(examplePath, 'utf8'))
    console.log('  Creé el archivo .env a partir de .env.example.')
  }

  let texto = readFileSync(envPath, 'utf8')
  const env = parseEnv(texto)
  const faltan = VARIABLES.filter(([k]) => !env[k] || env[k].includes('TU_PROYECTO') || env[k] === 'sbp_')

  if (faltan.length) {
    console.log('  Dos variables, las dos de Supabase. Con el token el servidor busca las claves,')
    console.log('  crea las tablas y apaga los registros abiertos.\n')
    const rl = createInterface({ input: stdin, output: stdout })
    for (const [k, ayuda] of faltan) {
      const valor = (await rl.question(`  ${k} (${ayuda}): `)).trim()
      if (!valor) continue
      // Se reemplaza la línea si existe, se agrega si no.
      const re = new RegExp(`^${k}=.*$`, 'm')
      texto = re.test(texto) ? texto.replace(re, `${k}=${valor}`) : `${texto.trimEnd()}\n${k}=${valor}\n`
    }
    await rl.close()
    writeFileSync(envPath, texto)
    console.log('\n  .env guardado.')
  } else {
    console.log('  El .env ya tiene las dos variables.')
  }

  console.log('\n  Lo que sigue:\n')
  console.log('    1. npm run build   (compila el panel adentro del servidor)')
  console.log('    2. npm run dev     (servidor en http://localhost:3000 — crea las tablas al arrancar)')
  console.log('    3. Abrí http://localhost:3000 — el panel te pide el pack, el nombre del negocio')
  console.log('       y tu usuario. Después: Conexión (WhatsApp) y Studio (IA).\n')
  console.log('  Para ponerlo en línea, seguí docs/DEPLOY.md.\n')
}

main().catch((err) => {
  console.error(`\n  ${err.message}\n`)
  process.exit(1)
})
