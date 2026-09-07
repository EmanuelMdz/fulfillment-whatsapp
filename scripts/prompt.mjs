#!/usr/bin/env node
/**
 * El prompt del bot, entre el archivo y la base.
 *
 *   npm run prompt:push   prompts/negocio.md → base. El bot lo usa desde el
 *                         próximo mensaje. Studio lo muestra.
 *   npm run prompt:pull   base → prompts/negocio.md. Para traer lo que se
 *                         retocó en Studio y seguir editándolo en el repo.
 *
 * ¿Por qué un archivo y no solo la caja de Studio? Porque el prompt lo
 * escribe Claude, no el alumno: Claude redacta el archivo siguiendo
 * docs/PROMPTS.md, lo sube con este comando, y el alumno lo ve en Studio
 * para leerlo y retocarlo si quiere. La base es la fuente de verdad (es
 * lo que lee el bot); el archivo es la copia de trabajo.
 *
 * Usa las mismas dos variables que el servidor: con el token de acceso
 * busca la clave de servicio; si en cambio está SUPABASE_SERVICE_ROLE_KEY,
 * la usa directo.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const archivo = join(root, 'prompts', 'negocio.md')

function leerEnv() {
  const out = {}
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const clean = line.trim()
      if (!clean || clean.startsWith('#')) continue
      const eq = clean.indexOf('=')
      if (eq === -1) continue
      out[clean.slice(0, eq).trim()] = clean.slice(eq + 1).trim()
    }
  }
  // Lo que ya está en el entorno gana (en el hosting no hay archivo).
  for (const k of ['SUPABASE_URL', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (process.env[k]) out[k] = process.env[k]
  }
  return out
}

async function claveDeServicio(env) {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY
  if (!env.SUPABASE_ACCESS_TOKEN) {
    throw new Error('Falta SUPABASE_ACCESS_TOKEN (o SUPABASE_SERVICE_ROLE_KEY) en el .env')
  }
  const ref = env.SUPABASE_URL.match(/^https?:\/\/([a-z0-9-]+)\./i)?.[1]
  if (!ref) throw new Error(`SUPABASE_URL no parece de Supabase: ${env.SUPABASE_URL}`)
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Supabase respondió ${res.status} al pedir las claves (¿el token es válido?)`)
  const keys = await res.json()
  const service = keys.find((k) => k.name === 'service_role')?.api_key
  if (!service) throw new Error('Supabase no devolvió la clave service_role')
  return service
}

async function main() {
  const accion = process.argv[2]
  if (accion !== 'push' && accion !== 'pull') {
    console.log('\n  Uso: npm run prompt:push   |   npm run prompt:pull\n')
    process.exit(1)
  }

  const env = leerEnv()
  if (!env.SUPABASE_URL) throw new Error('Falta SUPABASE_URL en el .env')
  const service = await claveDeServicio(env)
  const base = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/prompts?section=eq.sistema&channel=is.null`
  const headers = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
  }

  if (accion === 'pull') {
    const res = await fetch(`${base}&select=content`, { headers })
    if (!res.ok) throw new Error(`No se pudo leer el prompt: ${res.status} ${await res.text()}`)
    const filas = await res.json()
    if (!filas.length) throw new Error('La base no tiene prompt todavía (¿corrió el servidor al menos una vez?)')
    mkdirSync(dirname(archivo), { recursive: true })
    writeFileSync(archivo, filas[0].content.trimEnd() + '\n')
    console.log(`\n  Bajado a prompts/negocio.md (${filas[0].content.length} caracteres).\n`)
    return
  }

  if (!existsSync(archivo)) throw new Error('No existe prompts/negocio.md. Escribilo (ver docs/PROMPTS.md) o bajá el actual con npm run prompt:pull')
  const content = readFileSync(archivo, 'utf8').trim()
  if (!content) throw new Error('prompts/negocio.md está vacío')

  const res = await fetch(base, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ content, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`No se pudo subir el prompt: ${res.status} ${await res.text()}`)
  const filas = await res.json()
  if (!filas.length) {
    // Base recién creada sin la fila: se crea.
    const alta = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/prompts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ section: 'sistema', content }),
    })
    if (!alta.ok) throw new Error(`No se pudo crear el prompt: ${alta.status} ${await alta.text()}`)
  }
  console.log(`\n  Subido (${content.length} caracteres). El bot lo usa desde el próximo mensaje; Studio ya lo muestra.\n`)
}

main().catch((err) => {
  console.error(`\n  ${err.message}\n`)
  process.exit(1)
})
