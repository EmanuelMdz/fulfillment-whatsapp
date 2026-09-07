import { Hono } from 'hono'
import { getSettings } from '../config/settings.js'
import { botPuedeResponder } from '../config/test-mode.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { whatsapp } from '../providers/waha.js'
import {
  cancelPendingFollowups,
  findMessageByExternalId,
  findOrCreateConversation,
  pauseForHuman,
  recentlySentByUs,
  receiveCustomerMessage,
  saveMessage,
} from '../db/queries.js'

/**
 * Entrada de mensajes.
 *
 * Hace tres cosas y ninguna más: guarda lo que llegó, decide si un humano
 * tomó la conversación, y agenda el turno. Contestar es trabajo de otro
 * (workers/turns.ts).
 *
 * Confirma solo lo que quedó guardado y agendado. La transacción y el
 * índice de external_id permiten reintentos sin perder ni duplicar turnos.
 */
export const webhookRoute = new Hono()

webhookRoute.post('/', async (c) => {
  const s = await getSettings()

  // El secreto es OBLIGATORIO. Lo genera el servidor al arrancar la
  // sesión desde el panel y viaja en la URL del webhook. Sin esto,
  // cualquiera que conozca la URL puede hacerle decir cosas al bot —
  // desde el número del negocio, con la clave de IA del negocio.
  const recibido = c.req.header('x-webhook-secret') ?? c.req.query('secret')
  if (!s.whatsapp.webhookSecret || recibido !== s.whatsapp.webhookSecret) {
    return c.json({ error: 'secreto inválido' }, 401)
  }

  let payload: unknown
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ ok: true, ignorado: 'cuerpo ilegible' })
  }

  const mensaje = whatsapp().parseWebhook(payload)
  if (!mensaje) return c.json({ ok: true, ignorado: 'evento que no nos interesa' })

  try {
    const conversacion = await findOrCreateConversation(
      'whatsapp',
      mensaje.chatId,
      mensaje.displayName,
    )

    // ── Eco: el mensaje lo mandó el negocio ──────────────────
    if (mensaje.isEcho) {
      const yaGuardado = await findMessageByExternalId(conversacion.id, mensaje.externalId)

      // Si ya lo teníamos, lo mandamos nosotros por la cola. Y si todavía
      // no está guardado pero la cola lo acaba de mandar, también es
      // nuestro: el eco le ganó la carrera al guardado.
      if ((yaGuardado && yaGuardado.author !== 'human') || (!yaGuardado && await recentlySentByUs(mensaje.chatId, mensaje.text))) {
        return c.json({ ok: true, eco: 'propio' })
      }

      if (conversacion.handback_at && mensaje.timestamp.getTime() <= new Date(conversacion.handback_at).getTime()) {
        return c.json({ ok: true, ignorado: 'eco anterior a devolver al bot' })
      }

      // No lo teníamos: lo escribió una persona desde el celular.
      // El bot se calla hasta que lo devuelvan.
      await saveMessage({
        conversationId: conversacion.id,
        externalId: mensaje.externalId,
        direction: 'out',
        author: 'human',
        body: mensaje.text,
        providerTs: mensaje.timestamp,
      })
      await pauseForHuman(conversacion.id)
      // Con una persona atendiendo, un recordatorio del bot en el medio
      // del chat la pisa. Fuera.
      await cancelPendingFollowups(conversacion.id)
      console.log(`[webhook] humano tomó la conversación ${conversacion.chat_id}`)
      logEvent({ eventType: 'conversation.human_takeover', conversationId: conversacion.id })
      return c.json({ ok: true, eco: 'humano' })
    }

    // ── Mensaje del cliente ──────────────────────────────────
    const permitido = botPuedeResponder(s.config, mensaje.chatId)
    const guardado = await receiveCustomerMessage({
      conversationId: conversacion.id,
      externalId: mensaje.externalId,
      body: mensaje.text,
      mediaUrl: mensaje.media?.url || null,
      mediaKind: mensaje.media?.kind ?? null,
      providerTs: mensaje.timestamp,
      canRespond: permitido,
      delaySeconds: s.bot.debounceSeconds,
    })

    // saveMessage devuelve null cuando el mensaje ya estaba: el puente lo
    // reenvió. Sin esto, cada reintento correría el turno de nuevo.
    if (!guardado) return c.json({ ok: true, ignorado: 'mensaje repetido' })

    // Una conversación cerrada a la que el cliente vuelve a escribir se
    // reabre sola: "cerrado" es "terminó", no "no atender". Descartar a
    // alguien para siempre es una decisión humana, y se toma en el panel.
    if (conversacion.state === 'cerrado') {
      conversacion.state = 'bot'
      logEvent({ eventType: 'conversation.reopened', conversationId: conversacion.id })
    }

    // Con la conversación en manos de una persona, no agendamos nada.
    if (conversacion.state !== 'bot') {
      return c.json({ ok: true, guardado: true, turno: 'no, está con un humano' })
    }

    // Modo prueba: el mensaje ya quedó guardado y se ve en el panel (una
    // persona puede contestarlo a mano), pero el bot no le habla a nadie
    // que no esté en la lista de números autorizados.
    if (!permitido) {
      logEvent({
        eventType: 'turn.skipped',
        conversationId: conversacion.id,
        payload: { motivo: 'modo_prueba' },
      })
      return c.json({ ok: true, guardado: true, turno: 'no, modo prueba' })
    }

    return c.json({ ok: true, guardado: true, turno: `en ${s.bot.debounceSeconds}s` })
  } catch (error) {
    // WAHA puede reintentar: la recepción es atómica y deduplica por id.
    const detalle = describe(error)
    console.error('[webhook] falló:', detalle)
    logEvent({
      eventType: 'internal.error',
      severity: 'error',
      payload: { donde: 'webhook', error: detalle.slice(0, 300) },
    })
    return c.json({ ok: false, error: 'No se pudo procesar el mensaje; reintentá.' }, 503)
  }
})
