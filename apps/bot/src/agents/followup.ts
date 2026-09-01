import { formatNowForPrompt } from '../utils/datetime.js'
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
 */

const MAX_FOLLOWUPS = 2
const MIN_HOURS = 0.25
const MAX_HOURS = 48

// Ventana nocturna: de 23:00 a 08:59 (hora local del negocio) no se
// molesta a nadie. Un recordatorio a las 2 de la mañana no recupera una
// venta: la quema.
export const NIGHT_START_HOUR = 23
export const NIGHT_END_HOUR = 9

function localHour(date: Date, timezone: string): number {
  return parseInt(
    date.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }),
  )
}

export function isNightAt(date: Date, timezone: string): boolean {
  const h = localHour(date, timezone)
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR
}

/**
 * Si la fecha cae en la ventana nocturna, la corre a las 09:30 de la
 * mañana siguiente. Los offsets de hora entera preservan los minutos.
 */
export function adjustForNightWindow(date: Date, timezone: string): Date {
  const h = localHour(date, timezone)
  const esNoche = h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR
  if (!esNoche) return date
  const horasAdelante = (NIGHT_END_HOUR - h + 24) % 24
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

/**
 * Decide y programa los seguimientos de esta conversación.
 * Best-effort: el que llama nunca debe romperse porque esto falle.
 */
export async function planFollowups(
  conversacion: Conversation,
  historial: HistoryMessage[],
  config: AppConfig,
): Promise<void> {
  const [prompts, previos] = await Promise.all([
    getPrompts(conversacion.channel),
    getSentFollowupMessages(conversacion.id),
  ])

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

  let programados = 0
  for (const item of lista.slice(0, MAX_FOLLOWUPS)) {
    const fu = item as { mensaje?: unknown; en_horas?: unknown }
    if (typeof fu.mensaje !== 'string' || !fu.mensaje.trim()) continue

    // Horas fuera de rango = alucinación → el fallback probado: primer
    // recordatorio a +1-4h (al azar, para no parecer un metrónomo),
    // segundo a +23h.
    let horas = typeof fu.en_horas === 'number' && Number.isFinite(fu.en_horas) ? fu.en_horas : NaN
    if (!(horas >= MIN_HOURS && horas <= MAX_HOURS)) {
      horas = programados === 0 ? 1 + Math.random() * 3 : 23
      logEvent({
        eventType: 'followup.dropped',
        severity: 'warn',
        conversationId: conversacion.id,
        payload: { motivo: 'horas_invalidas_fallback', valor: String(fu.en_horas) },
      })
    }

    const cuando = adjustForNightWindow(
      new Date(Date.now() + horas * 3600000),
      config.timezone,
    )

    await scheduleFollowup(conversacion.id, fu.mensaje.trim(), cuando.toISOString())
    programados++
    logEvent({
      eventType: 'followup.scheduled',
      conversationId: conversacion.id,
      payload: { en_horas: Math.round(horas * 10) / 10, para: cuando.toISOString() },
    })
  }
}
