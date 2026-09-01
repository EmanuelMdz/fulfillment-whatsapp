import { Hono } from 'hono'
import { loadEnv, hasWhatsapp, hasLlm } from '../config/env.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { whatsapp } from '../providers/waha.js'
import { buildTurnContext } from '../agents/context.js'
import { parseTurnDecision } from '../agents/decision.js'
import { chat, type Turn } from '../agents/llm.js'
import {
  cancelPendingFollowups,
  closeConversation,
  enqueueSend,
  getConversationById,
  handbackToBot,
  hasPendingSends,
  history,
  lastInboundId,
  pauseForHuman,
  resolveOpenReview,
  scheduleTurn,
} from '../db/queries.js'

/**
 * La API del panel: las acciones que el navegador NO puede hacer solo
 * contra la base — todo lo que toca WhatsApp o necesita pasos atados.
 *
 * Lo que es puro dato (leer conversaciones, editar prompts, prender
 * módulos) el panel lo hace directo contra Supabase con la sesión del
 * usuario; acá solo vive lo que necesita al servidor en el medio.
 *
 * Todas las rutas exigen un usuario logueado (ver middleware/auth.ts).
 */
export const panelRoute = new Hono()

// ── Responder como humano ────────────────────────────────────
// El mensaje sale por la MISMA cola que todo (con su ritmo), y el bot se
// calla en ese chat: responder a mano ES tomar el control.
panelRoute.post('/reply', async (c) => {
  let body: { conversation_id?: unknown; message?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }
  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : null
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!conversationId || !message) {
    return c.json({ error: 'Faltan conversation_id y message' }, 400)
  }

  const conversacion = await getConversationById(conversationId)
  if (!conversacion) return c.json({ error: 'Conversación no encontrada' }, 404)

  await enqueueSend({
    conversationId: conversacion.id,
    channel: conversacion.channel,
    chatId: conversacion.chat_id,
    body: message,
    author: 'human',
  })
  await pauseForHuman(conversacion.id)
  await cancelPendingFollowups(conversacion.id)
  logEvent({
    eventType: 'conversation.human_takeover',
    conversationId: conversacion.id,
    payload: { origen: 'panel' },
  })
  return c.json({ ok: true, estado: 'humano' })
})

// ── Devolver al bot ──────────────────────────────────────────
// Deja el watermark de handback (la evidencia humana vieja no vuelve a
// pausar), resuelve el caso de revisión y, si quedó un mensaje del
// cliente sin responder, despierta el turno — salvo que el operador tenga
// un envío todavía en cola: no se le compite a una persona escribiendo.
panelRoute.post('/handback', async (c) => {
  let body: { conversation_id?: unknown; wake?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }
  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : null
  if (!conversationId) return c.json({ error: 'Falta conversation_id' }, 400)
  const quiereDespertar = body.wake !== false

  const conversacion = await getConversationById(conversationId)
  if (!conversacion) return c.json({ error: 'Conversación no encontrada' }, 404)

  await handbackToBot(conversacion.id)
  await resolveOpenReview(conversacion.id)
  logEvent({ eventType: 'conversation.handback', conversationId: conversacion.id })

  let despierta = 'no'
  if (quiereDespertar) {
    const hilo = await history(conversacion.id, 1)
    const ultimoEsCliente = hilo[hilo.length - 1]?.author === 'customer'
    const operadorEscribiendo = await hasPendingSends(conversacion.id)
    if (ultimoEsCliente && !operadorEscribiendo) {
      // Turno corto (no el debounce entero): el mensaje ya esperó bastante.
      await scheduleTurn(conversacion.id, await lastInboundId(conversacion.id), 5)
      despierta = 'en 5s'
    }
  }
  return c.json({ ok: true, estado: 'bot', turno: despierta })
})

// ── Cerrar conversación ──────────────────────────────────────
panelRoute.post('/close', async (c) => {
  let body: { conversation_id?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }
  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : null
  if (!conversationId) return c.json({ error: 'Falta conversation_id' }, 400)

  await closeConversation(conversationId)
  await resolveOpenReview(conversationId)
  await cancelPendingFollowups(conversationId)
  return c.json({ ok: true, estado: 'cerrado' })
})

// ── Probar el bot sin gastar un número ───────────────────────
// El mismo contexto y el mismo contrato del turno real, pero sin tocar
// la base ni WhatsApp: el navegador manda el historial y recibe la
// DECISIÓN completa — incluidos derivación, datos y pedido — para que
// se vea qué habría hecho el bot de verdad.
panelRoute.post('/test-chat', async (c) => {
  const env = loadEnv()
  if (!hasLlm(env)) {
    return c.json({ error: 'Falta la clave del modelo (GEMINI_API_KEY u OPENAI_API_KEY)' }, 400)
  }
  let body: { messages?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }
  if (!Array.isArray(body.messages) || !body.messages.length) {
    return c.json({ error: 'Falta messages: [{role, content}]' }, 400)
  }

  const turnos: Turn[] = (body.messages as Array<{ role?: unknown; content?: unknown }>)
    .filter((m) => typeof m.content === 'string' && (m.content as string).trim())
    .slice(-30)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: (m.content as string).trim(),
    }))

  try {
    const { system, config } = await buildTurnContext('whatsapp')
    const crudo = await chat(system, turnos)
    const decision = parseTurnDecision(
      crudo,
      (config.escalation_reasons ?? []).map((r) => r.key),
    )
    return c.json({ ok: true, decision, crudo })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})

// ── Conexión de WhatsApp (sesión + QR) ───────────────────────

panelRoute.get('/session', async (c) => {
  const env = loadEnv()
  if (!hasWhatsapp(env)) {
    return c.json({ configured: false, status: 'SIN_CONFIGURAR' })
  }
  try {
    const { status } = await whatsapp().sessionStatus()
    return c.json({ configured: true, status })
  } catch (err) {
    return c.json({ configured: true, status: 'SIN_SESION', detail: describe(err) })
  }
})

panelRoute.post('/session/start', async (c) => {
  const env = loadEnv()
  if (!hasWhatsapp(env)) {
    return c.json({ error: 'Configurá WHATSAPP_API_URL y WHATSAPP_API_KEY primero' }, 400)
  }
  // La URL del webhook: la pública si está seteada; si no, el origen de
  // esta misma request (en el hosting es el dominio público del deploy).
  const base = env.publicUrl || new URL(c.req.url).origin
  const webhookUrl = `${base}/webhook/whatsapp`
  try {
    await whatsapp().startSession(webhookUrl)
    return c.json({ ok: true, webhook: webhookUrl })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})

panelRoute.get('/session/qr', async (c) => {
  try {
    const dataUrl = await whatsapp().qrImage()
    if (!dataUrl) return c.json({ qr: null, detail: 'La sesión no está pidiendo QR ahora' })
    return c.json({ qr: dataUrl })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})
