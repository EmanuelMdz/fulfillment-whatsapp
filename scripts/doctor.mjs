#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseEnv, environmentProblems } from './lib/environment.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = join(root, '.env')
const env = { ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}), ...process.env }
let failed = false
function check(ok, success, failure) {
  console.log(`${ok ? 'OK' : 'FALTA'}  ${ok ? success : failure}`)
  if (!ok) failed = true
}
console.log('\nDiagnóstico local — no conecta cuentas, no modifica datos ni imprime claves.\n')
check(Number(process.versions.node.split('.')[0]) === 24, `Node ${process.versions.node}`, 'Instalá Node.js 24 LTS y volvé a abrir la terminal.')
check(existsSync(join(root, 'node_modules', '.package-lock.json')), 'Dependencias instaladas', 'Ejecutá npm ci desde la raíz del repo.')
const problems = environmentProblems(env)
check(!problems.length, 'Variables con formato válido (su acceso todavía no fue probado)', problems.join('\nFALTA  '))
check(existsSync(join(root, 'apps/bot/public/index.html')) && existsSync(join(root, 'apps/bot/dist/index.js')),
  'Panel y servidor compilados', 'Ejecutá npm run build.')
console.log('\nDespués: npm run dev y abrí http://localhost:' + (env.PORT || 3000))
console.log('El asistente verifica la base; Studio prueba la IA; Conexión prueba el puente.')
console.log('La prueba completa está en docs/PRUEBAS.md.\n')
process.exitCode = failed ? 1 : 0
