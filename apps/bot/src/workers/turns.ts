import { loadEnv, hasLlm } from '../config/env.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { notifyReview, notifyTurnFailed } from '../notifications/notify.js'
import { buildTurnContext } from '../agents/context.js'
import { parseTurnDecision } from '../agents/decision.js'
import { planFollowups } from '../agents/followup.js'
import { chat, type Turn } from '../agents/llm.js'
import {
  cancelPendingFollowups,
  claimDueTurns,
  enqueueSend,
  getConfig,
  history,
  lastInboundId,
  lastInboundPreview,
  mergeCollectedData,
  pauseForHuman,
  queueReview,
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
 *
 * El turno no es solo "preguntarle al modelo": es una fila de guardas
 * alrededor del modelo. Cada una existe por un incidente real — el bot
 * repitiéndose en loop, contestando dos veces lo mismo, devolviendo
 * vacío. El modelo propone; el código decide qué sale de verdad.
 */

let corriendo = false
let avisoApagado = false

const LINEA_PUENTE = 'Dame un momentito que lo reviso y te escribo 🙌'

/**
 * La conversación pasa a manos del equipo: el bot se calla, queda un caso
 * en la cola de revisión y el grupo recibe un aviso (una vez por
 * episodio). "Devolver al bot" desde el panel la destraba.
 */
async function escalar(
  conversacion: Conversation,
  reason: string,
  reasonLabel: string,
  detail: string,
): Promise<void> {
  await pauseForHuman(conversacion.id)
  // El chat quedó en manos del equipo: un recordatorio del bot en el
  // medio pisaría a la persona que lo atiende.
  await cancelPendingFollowups(conversacion.id)
  const nuevo = await queueReview(conversacion.id, reason, detail)
  logEvent({
    eventType: 'review.queued',
    conversationId: conversacion.id,
    payload: { reason, nuevo },
  })
  await notifyReview({
    conversationId: conversacion.id,
    chatId: conversacion.chat_id,
    reasonLabel,
    lastMessage: detail || undefined,
    episodeKey: `revision:${conversacion.last_inbound_id ?? conversacion.id}`,
  })
}

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

  // ¿Hay algo nuevo que contestar? Si el último mensaje del hilo no es
  // del cliente, este mensaje ya fue respondido (o lo respondió una
  // persona). Correr el modelo acá es gastar plata para repetirse.
  const ultimoDelHilo = historial[historial.length - 1]
  if (ultimoDelHilo.author !== 'customer') {
    logEvent({
      eventType: 'turn.skipped',
      conversationId: conversacion.id,
      payload: { motivo: 'ya_respondido' },
    })
    return
  }

  const cuerposBot = historial
    .filter((m) => m.author === 'bot')
    .map((m) => m.body.trim().toLowerCase())

  // Guarda anti-loop: el bot mandó EL MISMO mensaje 3 veces seguidas.
  // Está atascado — mandarlo una cuarta vez no lo va a desatascar. Pasa a
  // una persona, sin mensaje extra: a esta altura el bot ya habló de sobra.
  const ultimasTres = cuerposBot.slice(-3)
  if (ultimasTres.length === 3 && new Set(ultimasTres).size === 1) {
    logEvent({
      eventType: 'guardrail.loop',
      severity: 'warn',
      conversationId: conversacion.id,
    })
    await escalar(
      conversacion,
      'loop_detectado',
      'El bot quedó en loop (mandó lo mismo 3 veces)',
      (await lastInboundPreview(conversacion.id)) ?? '',
    )
    return
  }

  const { system, config } = await buildTurnContext(conversacion.channel)
  const turnos: Turn[] = historial.map((m) => ({
    role: m.author === 'customer' ? 'user' : 'assistant',
    content: m.body,
  }))

  const crudo = await chat(system, turnos)
  const decision = parseTurnDecision(
    crudo,
    (config.escalation_reasons ?? []).map((r) => r.key),
  )

  // El modelo no devolvió nada usable. Antes que el silencio, una línea
  // puente — y el chat a revisión para que lo levante una persona.
  if (!decision.messages.length) {
    console.warn(`[turno] el modelo no devolvió nada para ${conversacion.chat_id}`)
    await enqueueSend({
      conversationId: conversacion.id,
      channel: conversacion.channel,
      chatId: conversacion.chat_id,
      body: LINEA_PUENTE,
    })
    await escalar(
      conversacion,
      'respuesta_vacia',
      'El modelo devolvió una respuesta vacía',
      (await lastInboundPreview(conversacion.id)) ?? '',
    )
    return
  }

  // Guarda anti-repetición: si TODO lo que quiere mandar ya lo dijo en
  // sus últimos mensajes, no se manda — el cliente lo leyó y no le
  // alcanzó. Repetírselo es la mejor forma de perderlo.
  const recientes = cuerposBot.slice(-6)
  const nuevos = decision.messages.map((m) => m.trim().toLowerCase())
  if (recientes.length && nuevos.every((n) => recientes.includes(n))) {
    logEvent({
      eventType: 'guardrail.repeat',
      severity: 'warn',
      conversationId: conversacion.id,
    })
    await escalar(
      conversacion,
      'repeticion',
      'El bot iba a repetir su última respuesta',
      (await lastInboundPreview(conversacion.id)) ?? '',
    )
    return
  }

  // Las burbujas van a la cola en orden; el trabajador de envío les pone
  // el ritmo (una por vez, con pausas). Ver workers/send-queue.ts.
  for (const mensaje of decision.messages) {
    await enqueueSend({
      conversationId: conversacion.id,
      channel: conversacion.channel,
      chatId: conversacion.chat_id,
      body: mensaje,
    })
  }

  // La ficha se llena apenas hay datos, pase lo que pase después: si esto
  // corriera al final, cualquier salida temprana tiraría lo recolectado
  // (y la corrección de una dirección es EXACTAMENTE el dato que no se
  // puede perder).
  if (decision.data && conversacion.contact_id) {
    try {
      await mergeCollectedData(conversacion.contact_id, decision.data)
    } catch (err) {
      console.warn('[turno] no se pudo actualizar la ficha:', describe(err))
    }
  }

  // El modelo pidió derivar: la respuesta YA salió (el cliente nunca
  // queda mudo) y recién ahora la conversación pasa al equipo.
  if (decision.escalateReason) {
    const motivo = (config.escalation_reasons ?? []).find((r) => r.key === decision.escalateReason)
    await escalar(
      conversacion,
      decision.escalateReason,
      motivo?.label ?? decision.escalateReason,
      (await lastInboundPreview(conversacion.id)) ?? '',
    )
  }

  logEvent({
    eventType: 'turn.answered',
    conversationId: conversacion.id,
    payload: {
      burbujas: decision.messages.length,
      derivado: decision.escalateReason,
      con_datos: Boolean(decision.data),
    },
  })

  // Con la respuesta ya en la cola, se deciden los recordatorios. Corre
  // al final a propósito: es una segunda llamada al modelo y no puede
  // demorar la respuesta — y si falla, el turno ya está completo.
  if (!decision.escalateReason) {
    try {
      await planFollowups(conversacion, historial, config)
    } catch (err) {
      console.warn('[turno] no se pudieron planear seguimientos:', describe(err))
    }
  }
}

async function tick(): Promise<void> {
  if (corriendo) return
  corriendo = true

  try {
    // Llave general: con el bot apagado desde el panel no se reclama
    // NINGÚN turno. Los turnos quedan agendados en la base — al volver a
    // prenderlo, se contestan (tarde es mejor que nunca, y que mudo).
    const config = await getConfig()
    if (!config.bot_enabled) {
      if (!avisoApagado) {
        console.log('[turno] bot APAGADO desde el panel — los turnos esperan')
        avisoApagado = true
      }
      return
    }
    if (avisoApagado) {
      console.log('[turno] bot prendido de nuevo — retomando turnos')
      avisoApagado = false
    }

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
