import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from '../config/env.js'
import { disableSignups, runSql } from '../config/supabase-admin.js'
import { appliedMigrations } from './queries.js'
import { MIGRATION_REGISTRY_SQL, migrationSql } from '@fw/core'

/**
 * Las migraciones: qué falta y cómo aplicarlas.
 *
 * El servidor sabe exactamente qué tablas tiene que haber (los archivos
 * de packages/db/migrations) y qué ya se aplicó (la tabla _migrations).
 * La diferencia es lo pendiente.
 *
 * Aplicarlas solo es posible con el token de acceso de la cuenta
 * (SUPABASE_ACCESS_TOKEN): la API normal de Supabase no puede crear
 * tablas. Sin token, el asistente del panel muestra el mismo SQL para
 * pegar en el editor de Supabase.
 */

// apps/bot/src/db → la raíz del repo está cuatro niveles arriba. En
// dist/db es la misma distancia.
export const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..',
  'packages', 'db', 'migrations',
)

const CREATE_REGISTRO = MIGRATION_REGISTRY_SQL

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

export function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
}

/** ¿El servidor puede crear tablas solo? Sí cuando tiene el token de acceso. */
export function canAutoMigrate(): boolean {
  return Boolean(loadEnv().supabase.accessToken)
}

export async function pendingMigrations(): Promise<{ dbReady: boolean; pending: string[] }> {
  const aplicadas = await appliedMigrations()
  const archivos = migrationFiles()
  return {
    dbReady: aplicadas !== null,
    pending: aplicadas === null ? archivos : archivos.filter((f) => !aplicadas.includes(f)),
  }
}

/**
 * El SQL para pegar a mano: la tabla de registro, cada migración
 * pendiente y su fila en _migrations. Se puede pegar más de una vez.
 */
export function sqlBundle(pending: string[]): string {
  const partes = [
    '-- Fulfillment WhatsApp — pegá TODO esto en Supabase → SQL Editor → Run.',
    '-- Se puede pegar más de una vez sin romper nada.',
    CREATE_REGISTRO,
  ]
  for (const file of pending) {
    partes.push(`-- >>> ${file}`)
    partes.push(migrationSql(file, readMigration(file)))
  }
  return partes.join('\n\n')
}

/**
 * Aplica lo pendiente a través de la API de administración. Devuelve los
 * archivos aplicados. Cada migración es una llamada: si una falla, las
 * anteriores quedan aplicadas y anotadas, y el error dice cuál rompió.
 */
export async function applyPendingMigrations(): Promise<string[]> {
  const { ref, accessToken } = loadEnv().supabase
  if (!accessToken) throw new Error('Sin SUPABASE_ACCESS_TOKEN el servidor no puede crear tablas: pegá el SQL desde el asistente')

  const { pending } = await pendingMigrations()
  if (!pending.length) return []

  await runSql(ref, accessToken, CREATE_REGISTRO)
  for (const file of pending) {
    try {
      await runSql(ref, accessToken, migrationSql(file, readMigration(file)))
    } catch (err) {
      throw new Error(`La migración ${file} falló: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  // PostgREST (la API que usa el servidor) cachea el esquema: sin esto,
  // las tablas recién creadas tardan unos segundos en "existir" para él.
  await runSql(ref, accessToken, "select pg_notify('pgrst', 'reload schema');").catch(() => {})
  return pending
}

/** Apaga los registros abiertos de Auth. Solo con token; si no, se documenta el paso manual. */
export async function closeSignups(): Promise<boolean> {
  const { ref, accessToken } = loadEnv().supabase
  if (!accessToken) return false
  await disableSignups(ref, accessToken)
  return true
}
