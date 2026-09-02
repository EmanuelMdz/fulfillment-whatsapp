import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Carga el `.env` de la raíz del repo dentro de `process.env`.
 *
 * ¿Por qué existe esto y no usamos `dotenv`? Porque es media docena de
 * líneas y una dependencia menos que explicar en clase.
 *
 * Dos detalles que no son caprichos:
 *
 * - **Lo que ya está en el entorno gana.** En Railway no hay archivo: las
 *   variables las inyecta la plataforma. Si este cargador las pisara, un
 *   `.env` viejo que se coló en una imagen se llevaría puesta la
 *   configuración de producción.
 * - **El archivo se busca hacia arriba.** Uno solo en la raíz sirve al
 *   servidor y al panel (Vite lo lee con `envDir`), pero npm arranca el
 *   servidor con el directorio en `apps/bot`. Buscar hacia arriba hace
 *   que funcione igual desde la raíz, desde `apps/bot`, en desarrollo
 *   con tsx y compilado en `dist`.
 */

function findEnvFile(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url))
  // src/config y dist/config están a la misma distancia de la raíz, pero
  // no vale la pena contar niveles: se sube hasta encontrarlo.
  for (let i = 0; i < 6; i++) {
    const candidato = join(dir, '.env')
    if (existsSync(candidato)) return candidato
    const padre = dirname(dir)
    if (padre === dir) break
    dir = padre
  }
  return null
}

/** Una línea `CLAVE=valor`. Ignora comentarios y vacías. */
function parseLine(line: string): [string, string] | null {
  const clean = line.trim()
  if (!clean || clean.startsWith('#')) return null
  const eq = clean.indexOf('=')
  if (eq === -1) return null
  const key = clean.slice(0, eq).trim()
  let value = clean.slice(eq + 1).trim()
  // Una contraseña o una URI de Postgres puede venir entre comillas.
  if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1)
  }
  return key ? [key, value] : null
}

/** Se llama una sola vez, al importar `config/env.ts`. */
export function loadDotEnv(): void {
  const archivo = findEnvFile()
  if (!archivo) return
  for (const line of readFileSync(archivo, 'utf8').split('\n')) {
    const par = parseLine(line)
    if (!par) continue
    const [key, value] = par
    if (process.env[key] === undefined) process.env[key] = value
  }
}
