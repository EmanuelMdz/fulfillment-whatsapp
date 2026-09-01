import { loadEnv } from '../config/env.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { isNightAt } from '../agents/followup.js'
import {
  claimDueFollowups,
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
 */

// Un recordatorio con más de un día de atraso (el servidor estuvo caído,
// el bot estuvo apagado) ya no es un recordatorio: es un mensaje raro
// fuera de contexto. Mejor no mandarlo.
const OVERDUE_MS = 24 * 60 * 60 * 1000

let corriendo = false

async function despachar(fu: Followup): Promise<void> {
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

  await enqueueSend({
    conversationId: fu.conversation_id,
    channel: conv.channel,
    chatId: conv.chat_id,
    body: fu.message,
  })
  logEvent({ eventType: 'followup.sent', conversationId: fu.conversation_id })
}

async function tick(): Promise<void> {
  if (corriendo) return
  corriendo = true

  try {
    const config = await getConfig()
    // Con el bot apagado no sale nada; y de noche tampoco, sin importar
    // para cuándo estaba agendado — el bloqueo horario es duro. Los
    // pendientes quedan y salen a la mañana.
    if (!config.bot_enabled) return
    if (isNightAt(new Date(), config.timezone)) return

    const vencidos = await claimDueFollowups(5)
    for (const fu of vencidos) {
      try {
        await despachar(fu)
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
  const env = loadEnv()
  setInterval(() => {
    void tick()
  }, env.bot.followupTickMs)
  console.log(`[seguimiento] activo, revisando cada ${env.bot.followupTickMs / 1000}s`)
}
