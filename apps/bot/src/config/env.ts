/**
 * Variables de entorno, en un solo lugar y validadas al arrancar.
 *
 * Regla: si falta algo imprescindible, el servidor NO arranca y dice
 * exactamente qué falta. Un arranque a medias es peor que uno que falla.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Falta la variable ${name}. Copiá .env.example como .env y completala, o corré: npm run setup`,
    )
  }
  return value
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

export interface Env {
  port: number
  timezone: string
  logLevel: string
  supabase: { url: string; serviceKey: string }
  whatsapp: { apiUrl: string; apiKey: string; session: string; webhookSecret: string }
}

let cached: Env | null = null

export function loadEnv(): Env {
  if (cached) return cached

  cached = {
    port: Number(optional('PORT', '3000')),
    timezone: optional('TIMEZONE', 'America/Montevideo'),
    logLevel: optional('LOG_LEVEL', 'info'),
    supabase: {
      url: required('SUPABASE_URL'),
      serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    },
    // El puente de WhatsApp no se exige al arrancar: el panel levanta
    // igual y desde ahí se conecta el número por QR.
    whatsapp: {
      apiUrl: optional('WHATSAPP_API_URL'),
      apiKey: optional('WHATSAPP_API_KEY'),
      session: optional('WHATSAPP_SESSION', 'default'),
      webhookSecret: optional('WHATSAPP_WEBHOOK_SECRET'),
    },
  }

  return cached
}

/** ¿Ya está configurado el puente de WhatsApp? */
export function hasWhatsapp(env: Env): boolean {
  return Boolean(env.whatsapp.apiUrl && env.whatsapp.apiKey)
}
