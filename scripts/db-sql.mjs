#!/usr/bin/env node
/**
 * Imprime TODAS las migraciones, en orden, listas para pegar en
 * Supabase → SQL Editor. Es lo mismo que muestra el asistente del panel,
 * para quien prefiera la terminal o quiera preparar una base antes de
 * desplegar.
 *
 * Se puede pegar más de una vez: cada migración usa `if not exists` /
 * `or replace`, y la tabla _migrations anota lo aplicado para que el
 * asistente sepa qué falta.
 *
 *   npm run db:sql > instalar.sql
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIGRATION_REGISTRY_SQL, migrationSql } from '../packages/core/src/migrations.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'db', 'migrations')

const partes = [
  '-- Fulfillment WhatsApp — pegá TODO esto en Supabase → SQL Editor → Run.',
  MIGRATION_REGISTRY_SQL,
]
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  partes.push(`-- >>> ${file}`)
  partes.push(migrationSql(file, readFileSync(join(dir, file), 'utf8')))
}
process.stdout.write(partes.join('\n\n') + '\n')
