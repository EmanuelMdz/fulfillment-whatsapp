import { Hono } from 'hono'
import { loadEnv } from '../config/env.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { whatsapp } from '../providers/waha.js'
import {
  findMessageByExternalId,
  findOrCreateConversation,
  pauseForHuman,
  reopenConversation,
  saveMessage,
  scheduleTurn,
} from '../db/queries.js'

/**
 * Entrada de mensajes.
 *
 * Hace tres cosas y ninguna más: guarda lo que llegó, decide si un humano
 * tomó la conversación, y agenda el turno. Contestar es trabajo de otro
 * (workers/turns.ts).
 *
 * Responde 200 SIEMPRE que el mensaje se haya recibido, aunque después algo
 * falle: si devolvemos error, el puente reintenta y terminamos con el mismo
 * mensaje cuatro veces.
 */
export const webhookRoute = new Hono()

webhookRoute.post('/', async (c) => {
  const env = loadEnv()

  // El secreto es opcional en desarrollo, obligatorio si está configurado.
  if (env.whatsapp.webhookSecret) {
    const recibido = c.req.header('x-webhook-secret') ?? c.req.query('secret')
    if (recibido !== env.whatsapp.webhookSecret) {
      return c.json({ error: 'secreto inválido' }, 401)
    }
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

      // Si ya lo teníamos, lo mandamos nosotros por la cola. Nada que hacer.
      if (yaGuardado) return c.json({ ok: true, eco: 'propio' })

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
      console.log(`[webhook] humano tomó la conversación ${conversacion.chat_id}`)
      logEvent({ eventType: 'conversation.human_takeover', conversationId: conversacion.id })
      return c.json({ ok: true, eco: 'humano' })
    }

    // ── Mensaje del cliente ──────────────────────────────────
    const mensajeId = await saveMessage({
      conversationId: conversacion.id,
      externalId: mensaje.externalId,
      direction: 'in',
      author: 'customer',
      body: mensaje.text,
      mediaUrl: mensaje.media?.url ?? null,
      mediaKind: mensaje.media?.kind ?? null,
      providerTs: mensaje.timestamp,
    })

    // saveMessage devuelve null cuando el mensaje ya estaba: el puente lo
    // reenvió. Sin esto, cada reintento correría el turno de nuevo.
    if (!mensajeId) return c.json({ ok: true, ignorado: 'mensaje repetido' })

    // Una conversación cerrada a la que el cliente vuelve a escribir se
    // reabre sola: "cerrado" es "terminó", no "no atender". Descartar a
    // alguien para siempre es una decisión humana, y se toma en el panel.
    if (conversacion.state === 'cerrado') {
      await reopenConversation(conversacion.id)
      conversacion.state = 'bot'
      logEvent({ eventType: 'conversation.reopened', conversationId: conversacion.id })
    }

    // Con la conversación en manos de una persona, no agendamos nada.
    if (conversacion.state !== 'bot') {
      return c.json({ ok: true, guardado: true, turno: 'no, está con un humano' })
    }

    await scheduleTurn(conversacion.id, mensajeId, env.bot.debounceSeconds)
    return c.json({ ok: true, guardado: true, turno: `en ${env.bot.debounceSeconds}s` })
  } catch (error) {
    // Guardamos el problema pero contestamos 200: reintentar no lo arregla
    // y sí duplica mensajes.
    const detalle = describe(error)
    console.error('[webhook] falló:', detalle)
    logEvent({
      eventType: 'internal.error',
      severity: 'error',
      payload: { donde: 'webhook', error: detalle.slice(0, 300) },
    })
    return c.json({ ok: true, error: 'anotado' })
  }
})
