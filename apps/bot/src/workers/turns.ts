import { loadEnv, hasLlm } from '../config/env.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { notifyTurnFailed } from '../notifications/notify.js'
import { buildSystemPrompt } from '../agents/context.js'
import { chat, type Turn } from '../agents/llm.js'
import {
  claimDueTurns,
  enqueueSend,
  history,
  lastInboundId,
  lastInboundPreview,
  type Conversation,
} from '../db/queries.js'

/**
 * El turno: cuando le llega la hora a una conversación, contesta.
 *
 * ────────────────────────────────────────────────────────────
 * POR QUÉ NO ES UN setTimeout
 *
 * Cuando entra un mensaje no esperamos en memoria: anotamos en la base
 * cuándo hay que contestar. Este trabajador levanta lo que venció.
 *
 * La diferencia aparece el día que el servidor se reinicia justo después
 * de un despliegue: con un temporizador en memoria, esas conversaciones
 * quedaban sin respuesta y nadie se enteraba. Así, siguen agendadas y se
 * contestan igual.
 * ────────────────────────────────────────────────────────────
 */

let corriendo = false

async function responder(conversacion: Conversation): Promise<void> {
  // ¿Sigue siendo el último mensaje el que disparó este turno?
  //
  // Si el cliente siguió escribiendo mientras esperábamos, este turno ya
  // no sirve: hay otro agendado más atrás que va a contestar todo junto.
  // Esto es lo que evita contestar tres veces a tres mensajes seguidos.
  const ultimo = await lastInboundId(conversacion.id)
  if (ultimo && conversacion.last_inbound_id && ultimo !== conversacion.last_inbound_id) {
    logEvent({ eventType: 'turn.superseded', conversationId: conversacion.id })
    return
  }

  // Alguien pudo haber tomado la conversación entre que se agendó y ahora.
  if (conversacion.state !== 'bot') return

  const historial = await history(conversacion.id, 20)
  if (!historial.length) return

  const system = await buildSystemPrompt(conversacion.channel)
  const turnos: Turn[] = historial.map((m) => ({
    role: m.author === 'customer' ? 'user' : 'assistant',
    content: m.body,
  }))

  const respuesta = await chat(system, turnos)

  // Un modelo puede devolver vacío. Antes que mandar un mensaje en blanco,
  // no mandamos nada: el silencio se nota menos que un globo vacío.
  if (!respuesta.trim()) {
    console.warn(`[turno] el modelo no devolvió nada para ${conversacion.chat_id}`)
    return
  }

  await enqueueSend({
    conversationId: conversacion.id,
    channel: conversacion.channel,
    chatId: conversacion.chat_id,
    body: respuesta,
  })
  logEvent({
    eventType: 'turn.answered',
    conversationId: conversacion.id,
    payload: { chars: respuesta.length },
  })
}

async function tick(): Promise<void> {
  if (corriendo) return
  corriendo = true

  try {
    const vencidas = await claimDueTurns(5)
    for (const conversacion of vencidas) {
      try {
        await responder(conversacion)
      } catch (error) {
        // Una conversación que falla no puede frenar a las demás. Pero un
        // turno caído es un cliente MUDO: además de anotarlo, se avisa al
        // grupo — el error silencioso es el peor de todos, porque el
        // cliente escribe tres veces, nadie contesta y nadie se entera.
        const detalle = describe(error)
        console.error(`[turno] falló en ${conversacion.chat_id}:`, detalle)
        logEvent({
          eventType: 'turn.failed',
          severity: 'error',
          conversationId: conversacion.id,
          payload: { error: detalle.slice(0, 300) },
        })
        try {
          await notifyTurnFailed({
            conversationId: conversacion.id,
            chatId: conversacion.chat_id,
            errorMessage: detalle,
            lastMessage: (await lastInboundPreview(conversacion.id)) ?? undefined,
            // La clave es el mensaje que disparó el turno: si el turno se
            // re-ejecuta y vuelve a fallar, el grupo no recibe otro aviso.
            episodeKey: conversacion.last_inbound_id ?? `caido:${conversacion.id}`,
          })
        } catch (notifyError) {
          console.error('[turno] tampoco se pudo avisar al grupo:', describe(notifyError))
        }
      }
    }
  } catch (error) {
    console.error('[turno] error al reclamar:', describe(error))
  } finally {
    corriendo = false
  }
}

export function startTurns(): void {
  const env = loadEnv()
  if (!hasLlm(env)) {
    console.log('[turno] sin clave del modelo — el bot no va a contestar')
  }
  setInterval(() => {
    void tick()
  }, env.bot.turnTickMs)
  console.log(
    `[turno] activo, revisando cada ${env.bot.turnTickMs / 1000}s · espera de ${env.bot.debounceSeconds}s antes de contestar`,
  )
}
