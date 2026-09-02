import { getSettings } from '../config/settings.js'
import { formatNowForPrompt, safeTimezone } from '../utils/datetime.js'
import { extractJson } from './parsers.js'
import { chat } from './llm.js'
import { logEvent } from '../observability/events.js'
import {
  getPrompts,
  getSentFollowupMessages,
  scheduleFollowup,
  type AppConfig,
  type Conversation,
  type HistoryMessage,
} from '../db/queries.js'

/**
 * Los seguimientos: el mensaje que recupera al cliente que se fue.
 *
 * Después de cada respuesta del bot, este agente mira la conversación y
 * decide si programa recordatorios. La cadencia probada en producción:
 * el primero a +1-4 horas (retomando lo que quedó pendiente) y, si vale
 * la pena, un último toque al día siguiente. Más que eso es perseguir.
 *
 * El modelo decide QUÉ decir y CUÁNDO en horas relativas ("en_horas") —
 * nunca una fecha absoluta: pedirle fechas ISO a un modelo termina en
 * recordatorios programados para el mes pasado. Las horas las convierte
 * a fecha el código, que no alucina.
 *
 * Está partido en dos: `decideFollowups` pregunta y devuelve la lista
 * (así el panel puede mostrar "qué mandaría" sin agendar nada), y
 * `planFollowups` la agenda.
 */

const MAX_FOLLOWUPS = 2
const MIN_HOURS = 0.25
const MAX_HOURS = 48

function localHour(date: Date, timezone: string): number {
  return parseInt(
    date.toLocaleString('en-US', { timeZone: safeTimezone(timezone), hour: 'numeric', hour12: false }),
  )
}

/**
 * ¿La hora `h` cae en la ventana nocturna? La ventana cruza la
 * medianoche cuando start > end (23 → 9, lo normal); si no, es un tramo
 * del mismo día.
 */
function inQuietWindow(h: number, start: number, end: number): boolean {
  if (start === end) return false
  return start > end ? h >= start || h < end : h >= start && h < end
}

/**
 * Ventana nocturna: de `start` a `end` (hora local del negocio, editable
 * en Ajustes; por defecto 23 a 9) no se molesta a nadie. Un recordatorio
 * a las 2 de la mañana no recupera una venta: la quema.
 */
export function isNightAt(date: Date, timezone: string, start = 23, end = 9): boolean {
  return inQuietWindow(localHour(date, timezone), start, end)
}

/**
 * Si la fecha cae en la ventana nocturna, la corre a la media hora
 * después de que termina (09:30 con la ventana por defecto).
 */
export function adjustForNightWindow(date: Date, timezone: string, start = 23, end = 9): Date {
  const h = localHour(date, timezone)
  if (!inQuietWindow(h, start, end)) return date
  const horasAdelante = (end - h + 24) % 24
  const corrida = new Date(date.getTime() + horasAdelante * 3600000)
  corrida.setMinutes(30, 0, 0)
  return corrida
}

const CONTRATO = [
  'Respondé SOLO con un JSON válido, nada más:',
  '{"seguimientos": [{"mensaje": "...", "en_horas": 3}]}',
  '',
  '- Máximo 2 seguimientos: el primero entre 1 y 4 horas (según qué tan caliente está la conversación), y como mucho un último toque a las ~20-24 horas.',
  '- "en_horas" es un número de horas A PARTIR DE AHORA. Nunca una fecha.',
  '- Si no corresponde ningún recordatorio, devolvé {"seguimientos": []}.',
].join('\n')

export interface FollowupPlan {
  message: string
  /** Horas a partir de ahora, ya validadas (o el fallback probado). */
  hours: number
  /** Cuándo saldría, ya corrido fuera de la ventana nocturna. */
  at: Date
  /** true si las horas vinieron inválidas y se usó el fallback. */
  fallback: boolean
}

/**
 * Le pregunta al modelo qué recordatorios corresponden y devuelve la
 * lista. No agenda nada: eso es de planFollowups. `previos` son los
 * recordatorios ya enviados en esta conversación.
 */
export async function decideFollowups(
  channel: string,
  historial: HistoryMessage[],
  config: AppConfig,
  previos: string[],
): Promise<FollowupPlan[]> {
  const [prompts, s] = await Promise.all([getPrompts(channel), getSettings()])

  const system = [
    config.business_name ? `Trabajás en: ${config.business_name}.` : '',
    prompts.seguimientos ?? '',
    `Ahora es: ${formatNowForPrompt(config.timezone)} (hora local del negocio).`,
    // La regla anti-repetición vive acá y no en el prompt editable: es de
    // las que no se pueden perder editando desde el panel.
    'PROHIBIDO repetir el ángulo o el contenido de un recordatorio ya enviado antes en esta conversación.',
    CONTRATO,
  ]
    .filter(Boolean)
    .join('\n\n')

  const hilo = historial
    .map((m) => `${m.author === 'customer' ? 'Cliente' : m.author === 'human' ? 'Humano del negocio' : 'Bot'}: ${m.body}`)
    .join('\n')

  const user = [
    '=== CONVERSACIÓN (más viejo primero) ===',
    hilo,
    '',
    '=== RECORDATORIOS YA ENVIADOS EN ESTA CONVERSACIÓN ===',
    previos.length ? previos.map((m) => `- ${m}`).join('\n') : '(ninguno)',
    '',
    'Decidí si programás recordatorios y cuáles. El recordatorio es la continuación de lo último que dijo el bot.',
  ].join('\n')

  const crudo = await chat(system, [{ role: 'user', content: user }])
  const parsed = extractJson(crudo) as { seguimientos?: unknown } | null
  const lista = Array.isArray(parsed?.seguimientos) ? parsed.seguimientos : []

  const planes: FollowupPlan[] = []
  for (const item of lista.slice(0, MAX_FOLLOWUPS)) {
    const fu = item as { mensaje?: unknown; en_horas?: unknown }
    if (typeof fu.mensaje !== 'string' || !fu.mensaje.trim()) continue

    // Horas fuera de rango = alucinación → el fallback probado: primer
    // recordatorio a +1-4h (al azar, para no parecer un metrónomo),
    // segundo a +23h.
    let horas = typeof fu.en_horas === 'number' && Number.isFinite(fu.en_horas) ? fu.en_horas : NaN
    let fallback = false
    if (!(horas >= MIN_HOURS && horas <= MAX_HOURS)) {
      horas = planes.length === 0 ? 1 + Math.random() * 3 : 23
      fallback = true
    }

    const at = adjustForNightWindow(
      new Date(Date.now() + horas * 3600000),
      config.timezone,
      s.bot.quietHoursStart,
      s.bot.quietHoursEnd,
    )
    planes.push({ message: fu.mensaje.trim(), hours: horas, at, fallback })
  }
  return planes
}

/**
 * Decide y programa los seguimientos de esta conversación.
 * Best-effort: el que llama nunca debe romperse porque esto falle.
 */
export async function planFollowups(
  conversacion: Conversation,
  historial: HistoryMessage[],
  config: AppConfig,
): Promise<void> {
  const previos = await getSentFollowupMessages(conversacion.id)
  const planes = await decideFollowups(conversacion.channel, historial, config, previos)

  for (const plan of planes) {
    if (plan.fallback) {
      logEvent({
        eventType: 'followup.dropped',
        severity: 'warn',
        conversationId: conversacion.id,
        payload: { motivo: 'horas_invalidas_fallback' },
      })
    }
    await scheduleFollowup(conversacion.id, plan.message, plan.at.toISOString())
    logEvent({
      eventType: 'followup.scheduled',
      conversationId: conversacion.id,
      payload: { en_horas: Math.round(plan.hours * 10) / 10, para: plan.at.toISOString() },
    })
  }
}
