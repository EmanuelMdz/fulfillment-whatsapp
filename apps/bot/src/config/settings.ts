import { randomBytes } from 'node:crypto'
import { db } from '../db/client.js'
import { getConfig, type AppConfig } from '../db/queries.js'

/**
 * La configuración del negocio, leída de la base.
 *
 * Antes esto era el .env: claves de IA, dirección del puente de WhatsApp,
 * tiempos del bot. Cada valor ahí era un lugar donde el alumno se podía
 * equivocar, y cambiarlo pedía entrar al hosting y reiniciar. Ahora vive
 * en `app_config` (lo que no es secreto) y `app_secrets` (las claves), y
 * se edita desde el panel.
 *
 * ¿Por qué una caché de veinte segundos? Un turno del bot consulta esto
 * tres o cuatro veces; leer dos tablas por cada consulta es plata tirada.
 * ¿Por qué no para siempre? Porque el dueño pega una clave nueva en el
 * panel y espera que el bot la use ya. Cuando el panel guarda a través
 * del servidor, además se vacía a mano (forgetSettings).
 */

export const SECRET_KEYS = [
  'gemini_api_key',
  'openai_api_key',
  'whatsapp_api_key',
  'whatsapp_webhook_secret',
] as const
export type SecretKey = (typeof SECRET_KEYS)[number]

/** Cada cuánto miran la cola, los turnos y los seguimientos. No es config del negocio. */
export const TICK_MS = { send: 8_000, turn: 10_000, followup: 60_000 }

export interface Settings {
  config: AppConfig
  llm: { provider: 'gemini' | 'openai'; model: string; geminiKey: string; openaiKey: string }
  whatsapp: { apiUrl: string; apiKey: string; session: string; webhookSecret: string }
  /** URL pública del deploy, para los links en los avisos al grupo. */
  publicUrl: string
  bot: {
    debounceSeconds: number
    sendPauseMinMs: number
    sendPauseMaxMs: number
    quietHoursStart: number
    quietHoursEnd: number
  }
}

const VIGENCIA_MS = 20_000
let cache: Settings | null = null
let leidoEn = 0

export function forgetSettings(): void {
  cache = null
}

async function readSecrets(): Promise<Record<string, string>> {
  const res = await db().from('app_secrets').select('key, value')
  if (res.error) throw res.error
  const out: Record<string, string> = {}
  for (const row of (res.data ?? []) as Array<{ key: string; value: string }>) out[row.key] = row.value
  return out
}

/**
 * La URL pública, sin que nadie la escriba: Railway la informa en
 * RAILWAY_PUBLIC_DOMAIN y Render en RENDER_EXTERNAL_URL. Si el hosting no
 * la da, el dueño la completa en el panel (app_config.public_url).
 */
export function detectPublicUrl(config: Pick<AppConfig, 'public_url'>): string {
  if (config.public_url) return config.public_url.replace(/\/+$/, '')
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '')
  return ''
}

export async function getSettings(): Promise<Settings> {
  const ahora = Date.now()
  if (cache && ahora - leidoEn < VIGENCIA_MS) return cache

  const [config, secrets] = await Promise.all([getConfig(), readSecrets()])
  const provider = config.llm_provider === 'openai' ? 'openai' : 'gemini'

  cache = {
    config,
    llm: {
      provider,
      model: config.llm_model || (provider === 'openai' ? 'gpt-4.1-mini' : 'gemini-2.5-flash'),
      geminiKey: secrets.gemini_api_key ?? '',
      openaiKey: secrets.openai_api_key ?? '',
    },
    whatsapp: {
      apiUrl: (config.whatsapp_api_url ?? '').replace(/\/+$/, ''),
      apiKey: secrets.whatsapp_api_key ?? '',
      session: config.whatsapp_session || 'default',
      webhookSecret: secrets.whatsapp_webhook_secret ?? '',
    },
    publicUrl: detectPublicUrl(config),
    bot: {
      debounceSeconds: config.debounce_seconds ?? 90,
      sendPauseMinMs: config.send_pause_min_ms ?? 2000,
      sendPauseMaxMs: config.send_pause_max_ms ?? 6000,
      quietHoursStart: config.quiet_hours_start ?? 23,
      quietHoursEnd: config.quiet_hours_end ?? 9,
    },
  }
  leidoEn = ahora
  return cache
}

/** ¿Hay clave para el proveedor de modelos elegido? */
export function hasLlm(s: Settings): boolean {
  return Boolean(s.llm.provider === 'openai' ? s.llm.openaiKey : s.llm.geminiKey)
}

/** ¿Está configurado el puente de WhatsApp (URL y clave)? */
export function hasWhatsapp(s: Settings): boolean {
  return Boolean(s.whatsapp.apiUrl && s.whatsapp.apiKey)
}

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  const res = await db()
    .from('app_secrets')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (res.error) throw res.error
  forgetSettings()
}

/**
 * Lo que el panel puede saber de una clave: si está cargada y sus últimos
 * cuatro caracteres, para reconocerla. La clave entera no sale del
 * servidor jamás.
 */
export async function secretHints(): Promise<Record<SecretKey, { set: boolean; hint: string }>> {
  const secrets = await readSecrets()
  const out = {} as Record<SecretKey, { set: boolean; hint: string }>
  for (const key of SECRET_KEYS) {
    const v = secrets[key] ?? ''
    out[key] = { set: Boolean(v), hint: v ? `…${v.slice(-4)}` : '' }
  }
  return out
}

/**
 * El secreto del webhook lo inventa el servidor la primera vez que hace
 * falta. Nadie lo tipea, nadie lo ve: viaja en la URL del webhook que se
 * le da al puente, y el webhook lo compara. Ver routes/webhook.ts.
 */
export async function ensureWebhookSecret(): Promise<string> {
  const s = await getSettings()
  if (s.whatsapp.webhookSecret) return s.whatsapp.webhookSecret
  const nuevo = randomBytes(24).toString('hex')
  await setSecret('whatsapp_webhook_secret', nuevo)
  return nuevo
}
