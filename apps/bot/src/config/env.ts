/**
 * Variables de entorno. Son DOS: la URL del proyecto de Supabase y el
 * token de acceso de la cuenta. Con el token, el servidor busca las
 * claves del proyecto solo, crea las tablas que falten al arrancar y
 * apaga los registros abiertos. Todo lo demás (claves de IA, puente de
 * WhatsApp, tiempos) se carga desde el panel — ver config/settings.ts.
 *
 * Quien prefiera no darle el token de su cuenta al servidor puede cargar
 * en su lugar las dos claves del proyecto (Settings → API); en ese caso
 * las tablas se crean pegando un SQL desde el asistente del panel.
 *
 * Regla: si falta algo, el servidor NO arranca y dice exactamente qué.
 * Un arranque a medias es peor que uno que falla.
 */

import { loadDotEnv } from './dotenv.js'
import { fetchProjectKeys } from './supabase-admin.js'

// Antes de leer nada: el .env de la raíz entra en process.env. En el
// hosting no hay archivo y las variables ya vienen inyectadas; ahí esto
// no hace nada. Ver config/dotenv.ts.
loadDotEnv()

export interface Env {
  port: number
  supabase: {
    url: string
    /** El identificador del proyecto: lo que va antes de `.supabase.co`. */
    ref: string
    /** La clave pública. Va al navegador vía /config.js; la protección son las policies. */
    anonKey: string
    /** La clave de servicio saltea RLS. NUNCA sale del servidor. */
    serviceKey: string
    /** Token de acceso de la cuenta (sbp_…). Vacío = modo sin token: las tablas se pegan a mano. */
    accessToken: string
  }
}

let cached: Env | null = null

function required(name: string, ayuda: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta la variable ${name}. ${ayuda}`)
  return value
}

function refFromUrl(url: string): string {
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.(?:co|in|red)/i)
  if (!m) throw new Error(`SUPABASE_URL no parece la URL de un proyecto de Supabase: ${url}`)
  return m[1]
}

/**
 * Corre UNA vez al arrancar (index.ts la espera antes de levantar nada).
 * Es async porque con el token hay que pedirle las claves a Supabase.
 */
export async function initEnv(): Promise<Env> {
  if (cached) return cached

  const url = required(
    'SUPABASE_URL',
    'Es la Project URL de tu proyecto (Supabase → Settings → API).',
  ).replace(/\/+$/, '')
  const ref = refFromUrl(url)
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? ''
  let anonKey = process.env.SUPABASE_ANON_KEY?.trim() ?? ''
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''

  if (!(anonKey && serviceKey)) {
    if (!accessToken) {
      throw new Error(
        'Faltan las claves de Supabase. Lo simple: cargá SUPABASE_ACCESS_TOKEN (Supabase → Account → Access Tokens → Generate new token) y el servidor busca el resto. Si preferís no dar el token: SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY (Settings → API).',
      )
    }
    const keys = await fetchProjectKeys(ref, accessToken)
    anonKey ||= keys.anon
    serviceKey ||= keys.serviceRole
  }

  const port = Number(process.env.PORT)
  cached = {
    port: Number.isFinite(port) && port > 0 ? port : 3000,
    supabase: { url, ref, anonKey, serviceKey, accessToken },
  }
  return cached
}

/** La configuración ya cargada. Solo válida después de initEnv(). */
export function loadEnv(): Env {
  if (!cached) throw new Error('initEnv() tiene que correr antes de usar la configuración (ver index.ts)')
  return cached
}
