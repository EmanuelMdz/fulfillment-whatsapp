/**
 * Variables de entorno. Son TRES y todas de Supabase: lo mínimo para que
 * el proceso arranque y pueda leer el resto de la configuración de la
 * base. Todo lo demás (claves de IA, puente de WhatsApp, tiempos) se
 * carga desde el panel — ver config/settings.ts.
 *
 * Regla: si falta algo, el servidor NO arranca y dice exactamente qué.
 * Un arranque a medias es peor que uno que falla.
 */

import { loadDotEnv } from './dotenv.js'

// Antes de leer nada: el .env de la raíz entra en process.env. En el
// hosting no hay archivo y las variables ya vienen inyectadas; ahí esto
// no hace nada. Ver config/dotenv.ts.
loadDotEnv()

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Falta la variable ${name}. Sale de Supabase → Settings → API. En tu computadora: copiá .env.example como .env y completala.`,
    )
  }
  return value
}

export interface Env {
  port: number
  supabase: { url: string; anonKey: string; serviceKey: string }
}

let cached: Env | null = null

export function loadEnv(): Env {
  if (cached) return cached
  const port = Number(process.env.PORT)
  cached = {
    port: Number.isFinite(port) && port > 0 ? port : 3000,
    supabase: {
      url: required('SUPABASE_URL').replace(/\/+$/, ''),
      // La clave pública. Va al navegador a través de /config.js; la
      // protección son las policies de la base, no esta clave.
      anonKey: required('SUPABASE_ANON_KEY'),
      // La clave de servicio saltea RLS. NUNCA sale del servidor.
      serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    },
  }
  return cached
}
