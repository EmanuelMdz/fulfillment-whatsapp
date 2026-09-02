/**
 * Variables de entorno, en un solo lugar y validadas al arrancar.
 *
 * Regla: si falta algo imprescindible, el servidor NO arranca y dice
 * exactamente qué falta. Un arranque a medias es peor que uno que falla.
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
      `Falta la variable ${name}. Copiá .env.example como .env y completala, o corré: npm run setup`,
    )
  }
  return value
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

function num(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export interface Env {
  port: number
  timezone: string
  logLevel: string
  /**
   * URL pública del servidor (la del deploy en Railway). Se usa para armar
   * los links a la conversación en los avisos al grupo: WhatsApp solo hace
   * clickeable lo que empieza con http(s)://. Sin esto, los avisos salen
   * sin link.
   */
  publicUrl: string
  supabase: { url: string; serviceKey: string }
  whatsapp: { apiUrl: string; apiKey: string; session: string; webhookSecret: string }
  llm: { provider: 'gemini' | 'openai'; model: string; geminiKey: string; openaiKey: string }
  bot: {
    /** Cuánto se espera antes de contestar, para juntar los mensajes sueltos. */
    debounceSeconds: number
    /** Cada cuánto mira la cola de envío. */
    sendTickMs: number
    /** Cada cuánto busca turnos vencidos. */
    turnTickMs: number
    /** Cada cuánto busca seguimientos vencidos. */
    followupTickMs: number
    /** Pausa entre un envío y el siguiente, para no comerse un bloqueo. */
    sendPauseMinMs: number
    sendPauseMaxMs: number
  }
}

let cached: Env | null = null

export function loadEnv(): Env {
  if (cached) return cached

  const provider = optional('LLM_PROVIDER', 'gemini') === 'openai' ? 'openai' : 'gemini'

  cached = {
    port: num('PORT', 3000),
    timezone: optional('TIMEZONE', 'America/Montevideo'),
    logLevel: optional('LOG_LEVEL', 'info'),
    publicUrl: optional('PUBLIC_URL').replace(/\/+$/, ''),
    supabase: {
      url: required('SUPABASE_URL'),
      serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    },
    // El puente de WhatsApp no se exige al arrancar: el panel levanta
    // igual y desde ahí se conecta el número por QR.
    whatsapp: {
      apiUrl: optional('WHATSAPP_API_URL').replace(/\/$/, ''),
      apiKey: optional('WHATSAPP_API_KEY'),
      session: optional('WHATSAPP_SESSION', 'default'),
      webhookSecret: optional('WHATSAPP_WEBHOOK_SECRET'),
    },
    llm: {
      provider,
      model: optional('LLM_MODEL', provider === 'openai' ? 'gpt-4.1-mini' : 'gemini-2.5-flash'),
      geminiKey: optional('GEMINI_API_KEY'),
      openaiKey: optional('OPENAI_API_KEY'),
    },
    bot: {
      debounceSeconds: num('DEBOUNCE_SECONDS', 90),
      sendTickMs: num('SEND_TICK_MS', 8000),
      turnTickMs: num('TURN_TICK_MS', 10000),
      followupTickMs: num('FOLLOWUP_TICK_MS', 60000),
      sendPauseMinMs: num('SEND_PAUSE_MIN_MS', 2000),
      sendPauseMaxMs: num('SEND_PAUSE_MAX_MS', 6000),
    },
  }

  return cached
}

/** ¿Ya está configurado el puente de WhatsApp? */
export function hasWhatsapp(env: Env): boolean {
  return Boolean(env.whatsapp.apiUrl && env.whatsapp.apiKey)
}

/** ¿Hay clave para el proveedor de modelos elegido? */
export function hasLlm(env: Env): boolean {
  return Boolean(env.llm.provider === 'openai' ? env.llm.openaiKey : env.llm.geminiKey)
}
