import { getSettings, TICK_MS } from '../config/settings.js'
import { botPuedeResponder } from '../config/test-mode.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { isNightAt } from '../agents/followup.js'
import {
  claimDueFollowups,
  cleanupEventLog,
  enqueueSend,
  getConfig,
  getConversationById,
  markFollowupStatus,
  type Followup,
} from '../db/queries.js'

/**
 * El trabajador de seguimientos: levanta los recordatorios que vencieron
 * y los pone en la cola de envío.
 *
 * No manda nada él mismo — el ritmo y la protección del número son de la
 * cola (workers/send-queue.ts). Este solo decide QUÉ recordatorio sale y
 * cuál ya no tiene sentido mandar.
 *
 * De paso, una vez por día, limpia el registro de eventos viejo: es el
 * único trabajador que corre cada minuto y no cada segundos.
 */

// Un recordatorio con más de un día de atraso (el servidor estuvo caído,
// el bot estuvo apagado) ya no es un recordatorio: es un mensaje raro
// fuera de contexto. Mejor no mandarlo.
const OVERDUE_MS = 24 * 60 * 60 * 1000

const LIMPIEZA_CADA_MS = 24 * 60 * 60 * 1000
const EVENTOS_DIAS = 90

let corriendo = false
let ultimaLimpieza = 0

async function despachar(fu: Followup, config: Awaited<ReturnType<typeof getConfig>>): Promise<void> {
  if (Date.now() - new Date(fu.scheduled_at).getTime() > OVERDUE_MS) {
    await markFollowupStatus(fu.id, 'cancelled')
    logEvent({
      eventType: 'followup.dropped',
      conversationId: fu.conversation_id,
      payload: { motivo: 'vencido', agendado_para: fu.scheduled_at },
    })
    return
  }

  // La conversación pudo pasar a una persona (o cerrarse) después de
  // agendar. La cancelación por toma de control ya cubre esto, pero un
  // recordatorio pisando a un humano es tan caro que se chequea igual.
  const conv = await getConversationById(fu.conversation_id)
  if (!conv || conv.state !== 'bot') {
    await markFollowupStatus(fu.id, 'cancelled')
    logEvent({
      eventType: 'followup.dropped',
      conversationId: fu.conversation_id,
      payload: { motivo: 'sin_bot', estado: conv?.state ?? 'sin_conversacion' },
    })
    return
  }

  // Modo prueba: un recordatorio agendado antes de prenderlo no puede
  // salir hacia un número que ya no está autorizado.
  if (!botPuedeResponder(config, conv.chat_id)) {
    await markFollowupStatus(fu.id, 'cancelled')
    logEvent({
      eventType: 'followup.dropped',
      conversationId: fu.conversation_id,
      payload: { motivo: 'modo_prueba' },
    })
    return
  }

  await enqueueSend({
    conversationId: fu.conversation_id,
    channel: conv.channel,
    chatId: conv.chat_id,
    body: fu.message,
  })
  logEvent({ eventType: 'followup.sent', conversationId: fu.conversation_id })
}

async function limpiarEventos(): Promise<void> {
  if (Date.now() - ultimaLimpieza < LIMPIEZA_CADA_MS) return
  ultimaLimpieza = Date.now()
  try {
    const borrados = await cleanupEventLog(EVENTOS_DIAS)
    if (borrados) console.log(`[eventos] ${borrados} evento(s) de más de ${EVENTOS_DIAS} días borrados`)
  } catch (error) {
    console.warn('[eventos] no se pudo limpiar el registro:', describe(error))
  }
}

async function tick(): Promise<void> {
  if (corriendo) return
  corriendo = true

  try {
    await limpiarEventos()

    const [config, s] = await Promise.all([getConfig(), getSettings()])
    // Con el bot apagado no sale nada; y de noche tampoco, sin importar
    // para cuándo estaba agendado — el bloqueo horario es duro. Los
    // pendientes quedan y salen a la mañana.
    if (!config.bot_enabled) return
    if (isNightAt(new Date(), config.timezone, s.bot.quietHoursStart, s.bot.quietHoursEnd)) return

    const vencidos = await claimDueFollowups(5)
    for (const fu of vencidos) {
      try {
        await despachar(fu, config)
      } catch (error) {
        console.error('[seguimiento] falló:', describe(error))
        await markFollowupStatus(fu.id, 'failed').catch(() => {})
      }
    }
  } catch (error) {
    console.error('[seguimiento] error al reclamar:', describe(error))
  } finally {
    corriendo = false
  }
}

export function startFollowups(): void {
  setInterval(() => {
    void tick()
  }, TICK_MS.followup)
  console.log(`[seguimiento] activo, revisando cada ${TICK_MS.followup / 1000}s`)
}
