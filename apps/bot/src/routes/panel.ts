import { Hono, type Context } from 'hono'
import {
  SECRET_KEYS,
  forgetSettings,
  getSettings,
  hasLlm,
  hasWhatsapp,
  secretHints,
  setSecret,
} from '../config/settings.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { whatsapp } from '../providers/waha.js'
import { buildTurnContext } from '../agents/context.js'
import { parseTurnDecision } from '../agents/decision.js'
import { decideFollowups } from '../agents/followup.js'
import { chat, type Turn } from '../agents/llm.js'
import { db } from '../db/client.js'
import { applyPendingMigrations, canAutoMigrate } from '../db/migrate.js'
import type { PanelEnv } from '../middleware/auth.js'
import {
  EDITABLE_CONFIG_KEYS,
  addTeamMember,
  cancelPendingFollowups,
  closeConversation,
  enqueueSend,
  getConfig,
  getConversationById,
  handbackToBot,
  hasPendingSends,
  history,
  lastInboundId,
  listTeamMembers,
  pauseForHuman,
  removeTeamMember,
  resolveOpenReview,
  scheduleTurn,
  updateConfig,
  type AppConfig,
  type HistoryMessage,
} from '../db/queries.js'

/**
 * La API del panel: las acciones que el navegador NO puede hacer solo
 * contra la base — todo lo que toca WhatsApp, el modelo, las claves, los
 * usuarios, o necesita pasos atados.
 *
 * Lo que es puro dato (leer conversaciones, editar prompts, prender
 * módulos, las tres listas) el panel lo hace directo contra Supabase con
 * la sesión del usuario; acá solo vive lo que necesita al servidor en el
 * medio.
 *
 * Todas las rutas exigen un usuario del equipo (ver middleware/auth.ts).
 */
export const panelRoute = new Hono<PanelEnv>()

async function leerJson<T extends object>(c: Context): Promise<T | null> {
  try {
    return (await c.req.json()) as T
  } catch {
    return null
  }
}

function esZonaValida(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function entero(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  const r = Math.round(n)
  return r < min || r > max ? null : r
}

// ── Responder como humano ────────────────────────────────────
// El mensaje sale por la MISMA cola que todo (con su ritmo), y el bot se
// calla en ese chat: responder a mano ES tomar el control.
panelRoute.post('/reply', async (c) => {
  const body = await leerJson<{ conversation_id?: unknown; message?: unknown }>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : null
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!conversationId || !message) {
    return c.json({ error: 'Faltan conversation_id y message' }, 400)
  }
  // Sin puente, el mensaje quedaría "en cola" para siempre sin que nadie
  // sepa por qué. Mejor decirlo acá.
  if (!hasWhatsapp(await getSettings())) {
    return c.json({ error: 'Conectá WhatsApp primero (pestaña Conexión)' }, 409)
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
  const body = await leerJson<{ conversation_id?: unknown; wake?: unknown }>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
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
  const body = await leerJson<{ conversation_id?: unknown }>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
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

function turnosDesde(messages: unknown): Turn[] {
  if (!Array.isArray(messages)) return []
  return (messages as Array<{ role?: unknown; content?: unknown }>)
    .filter((m) => typeof m.content === 'string' && (m.content as string).trim())
    .slice(-30)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: (m.content as string).trim(),
    }))
}

panelRoute.post('/test-chat', async (c) => {
  if (!hasLlm(await getSettings())) {
    return c.json({ error: 'Falta la clave del modelo de IA: cargala en Studio' }, 400)
  }
  const body = await leerJson<{ messages?: unknown }>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
  const turnos = turnosDesde(body.messages)
  if (!turnos.length) return c.json({ error: 'Falta messages: [{role, content}]' }, 400)

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

// Lo que el modelo lee antes de contestar, tal cual: nombre, prompts,
// fecha, catálogo con ids, motivos. Es la forma de entender por qué
// contestó lo que contestó.
panelRoute.get('/test-context', async (c) => {
  try {
    const { system } = await buildTurnContext('whatsapp')
    return c.json({ system })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})

// Qué recordatorio mandaría el bot para esta conversación de prueba, y
// cuándo. No agenda nada.
panelRoute.post('/test-followups', async (c) => {
  if (!hasLlm(await getSettings())) {
    return c.json({ error: 'Falta la clave del modelo de IA: cargala en Studio' }, 400)
  }
  const body = await leerJson<{ messages?: unknown }>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
  const historial: HistoryMessage[] = turnosDesde(body.messages).map((t) => ({
    author: t.role === 'user' ? 'customer' : 'bot',
    body: t.content,
  }))
  if (!historial.length) return c.json({ error: 'Falta messages: [{role, content}]' }, 400)

  try {
    const config = await getConfig()
    const planes = await decideFollowups('whatsapp', historial, config, [])
    return c.json({
      ok: true,
      seguimientos: planes.map((p) => ({
        mensaje: p.message,
        en_horas: Math.round(p.hours * 10) / 10,
        cuando: p.at.toISOString(),
        fallback: p.fallback,
      })),
    })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})

// ── Conexión de WhatsApp (sesión + QR) ───────────────────────

panelRoute.get('/session', async (c) => {
  const s = await getSettings()
  const base = s.publicUrl || new URL(c.req.url).origin
  const extra = { public_url: s.publicUrl || null, webhook: `${base}/webhook/whatsapp` }
  if (!hasWhatsapp(s)) {
    return c.json({ configured: false, status: 'SIN_CONFIGURAR', ...extra })
  }
  try {
    const { status } = await whatsapp().sessionStatus()
    return c.json({ configured: true, status, ...extra })
  } catch (err) {
    return c.json({ configured: true, status: 'SIN_SESION', detail: describe(err), ...extra })
  }
})

panelRoute.post('/session/start', async (c) => {
  const s = await getSettings()
  if (!hasWhatsapp(s)) {
    return c.json({ error: 'Cargá la URL y la clave del puente de WhatsApp primero' }, 400)
  }
  // La URL del webhook: la pública si se conoce; si no, el origen de esta
  // misma request (en el hosting es el dominio público del deploy).
  const base = s.publicUrl || new URL(c.req.url).origin
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

// Los grupos del número conectado, para elegir el de avisos por nombre.
panelRoute.get('/groups', async (c) => {
  if (!hasWhatsapp(await getSettings())) return c.json({ groups: [], error: 'WhatsApp sin configurar' })
  try {
    return c.json({ groups: await whatsapp().listGroups() })
  } catch (err) {
    return c.json({ groups: [], error: describe(err) })
  }
})

// ── Claves ───────────────────────────────────────────────────
// El navegador nunca recibe una clave entera: solo si está cargada y sus
// últimos caracteres. Pegar una nueva la pisa; guardar vacío la borra.

panelRoute.get('/secrets', async (c) => c.json(await secretHints()))

panelRoute.post('/secrets', async (c) => {
  const body = await leerJson<Record<string, unknown>>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
  for (const key of SECRET_KEYS) {
    if (typeof body[key] === 'string') await setSecret(key, (body[key] as string).trim())
  }
  return c.json({ ok: true, claves: await secretHints() })
})

// Probar una clave sin adivinar: una llamada mínima al proveedor. Devuelve
// 200 con ok:false si falla, porque "falló la prueba" no es un error del
// servidor: es la respuesta.
panelRoute.post('/secrets/test', async (c) => {
  const body = await leerJson<{ que?: unknown }>(c)
  const que = body?.que
  try {
    if (que === 'llm') {
      const r = await chat('Respondé solo con la palabra OK.', [{ role: 'user', content: 'ping' }])
      return c.json({ ok: true, respuesta: r.slice(0, 40) })
    }
    if (que === 'whatsapp') {
      await whatsapp().ping()
      return c.json({ ok: true })
    }
    return c.json({ error: 'que debe ser llm o whatsapp' }, 400)
  } catch (err) {
    return c.json({ ok: false, error: describe(err) })
  }
})

// ── Configuración ────────────────────────────────────────────
// Lo de app_config que el servidor necesita leer al toque (modelo, puente,
// tiempos) se guarda por acá: se valida y se vacía la caché en el mismo
// paso. Las tres listas y los prompts siguen yendo directo a la base.

panelRoute.post('/settings', async (c) => {
  const body = await leerJson<Record<string, unknown>>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)

  const patch: Partial<AppConfig> = {}
  const errores: string[] = []

  for (const key of EDITABLE_CONFIG_KEYS) {
    if (!(key in body)) continue
    const v = body[key]
    switch (key) {
      case 'business_name':
      case 'llm_model':
      case 'whatsapp_session':
      case 'currency':
        if (typeof v !== 'string') errores.push(`${key}: texto`)
        else patch[key] = v.trim()
        break
      case 'whatsapp_api_url':
      case 'public_url':
        if (typeof v !== 'string') errores.push(`${key}: texto`)
        else if (v.trim() && !/^https?:\/\//.test(v.trim())) errores.push(`${key}: tiene que empezar con http:// o https://`)
        else patch[key] = v.trim().replace(/\/+$/, '')
        break
      case 'notify_chat_id':
        patch[key] = typeof v === 'string' && v.trim() ? v.trim() : null
        break
      case 'bot_enabled':
        patch[key] = Boolean(v)
        break
      case 'timezone':
        if (typeof v !== 'string' || !esZonaValida(v)) errores.push('zona horaria inválida')
        else patch[key] = v
        break
      case 'llm_provider':
        if (v !== 'gemini' && v !== 'openai') errores.push('el proveedor tiene que ser gemini u openai')
        else patch[key] = v
        break
      case 'debounce_seconds': {
        const n = entero(v, 5, 600)
        if (n === null) errores.push('la espera antes de contestar va de 5 a 600 segundos')
        else patch[key] = n
        break
      }
      case 'send_pause_min_ms':
      case 'send_pause_max_ms': {
        // Menos de un segundo entre envíos es pedir que bloqueen el número.
        const n = entero(v, 1000, 60_000)
        if (n === null) errores.push('las pausas van de 1000 a 60000 milisegundos')
        else patch[key] = n
        break
      }
      case 'quiet_hours_start':
      case 'quiet_hours_end': {
        const n = entero(v, 0, 23)
        if (n === null) errores.push('las horas de la ventana nocturna van de 0 a 23')
        else patch[key] = n
        break
      }
    }
  }

  if (
    typeof patch.send_pause_min_ms === 'number' &&
    typeof patch.send_pause_max_ms === 'number' &&
    patch.send_pause_max_ms < patch.send_pause_min_ms
  ) {
    errores.push('la pausa máxima tiene que ser mayor o igual que la mínima')
  }
  if (errores.length) return c.json({ error: errores.join('; ') }, 400)
  if (!Object.keys(patch).length) return c.json({ error: 'Nada para guardar' }, 400)

  await updateConfig(patch)
  forgetSettings()
  return c.json({ ok: true })
})

// El panel escribió app_config directo (las tres listas, los prompts):
// que el servidor se entere ya, sin esperar los veinte segundos de caché.
panelRoute.post('/settings/reload', (c) => {
  forgetSettings()
  return c.json({ ok: true })
})

// Una actualización trajo migraciones nuevas: con el token de acceso, el
// servidor las aplica acá mismo (el botón "Aplicar" de la franja).
panelRoute.post('/migrate', async (c) => {
  if (!canAutoMigrate()) {
    return c.json({ error: 'Sin SUPABASE_ACCESS_TOKEN el servidor no puede crear tablas: pegá el SQL' }, 400)
  }
  try {
    const aplicadas = await applyPendingMigrations()
    forgetSettings()
    return c.json({ ok: true, aplicadas })
  } catch (err) {
    return c.json({ error: describe(err) }, 502)
  }
})

// ── Usuarios ─────────────────────────────────────────────────
// Quién entra al panel. Las altas y bajas van por acá porque tocan Auth
// (clave de servicio) y team_members a la vez.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

panelRoute.get('/users', async (c) => {
  const [{ data, error }, equipo] = await Promise.all([
    db().auth.admin.listUsers({ page: 1, perPage: 200 }),
    listTeamMembers(),
  ])
  if (error) return c.json({ error: describe(error) }, 502)
  const roles = new Map(equipo.map((m) => [m.email, m.role]))
  const users = (data?.users ?? [])
    .filter((u) => u.email)
    .map((u) => ({
      id: u.id,
      email: u.email as string,
      role: roles.get((u.email as string).toLowerCase()) ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      created_at: u.created_at,
    }))
  return c.json({ users, me: c.get('userEmail') })
})

panelRoute.post('/users', async (c) => {
  const body = await leerJson<{ email?: unknown; password?: unknown; role?: unknown }>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = body.role === 'owner' ? 'owner' : 'member'
  if (!EMAIL_RE.test(email)) return c.json({ error: 'Email inválido' }, 400)
  if (password.length < 8) return c.json({ error: 'La contraseña tiene que tener al menos 8 caracteres' }, 400)

  const { error } = await db().auth.admin.createUser({ email, password, email_confirm: true })
  // Si el usuario ya existía en Auth pero no era del equipo, sumarlo al
  // equipo es exactamente lo que se pidió.
  if (error && !/already|exists|registered/i.test(error.message)) {
    return c.json({ error: describe(error) }, 502)
  }
  await addTeamMember(email, role)
  return c.json({ ok: true, existia: Boolean(error) })
})

panelRoute.post('/users/password', async (c) => {
  const body = await leerJson<{ id?: unknown; password?: unknown }>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
  const id = typeof body.id === 'string' ? body.id : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!id) return c.json({ error: 'Falta id' }, 400)
  if (password.length < 8) return c.json({ error: 'La contraseña tiene que tener al menos 8 caracteres' }, 400)
  const { error } = await db().auth.admin.updateUserById(id, { password })
  if (error) return c.json({ error: describe(error) }, 502)
  return c.json({ ok: true })
})

panelRoute.post('/users/remove', async (c) => {
  const body = await leerJson<{ id?: unknown }>(c)
  if (!body) return c.json({ error: 'JSON inválido' }, 400)
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return c.json({ error: 'Falta id' }, 400)

  const { data, error } = await db().auth.admin.getUserById(id)
  if (error || !data?.user?.email) return c.json({ error: 'Usuario no encontrado' }, 404)
  const email = data.user.email.toLowerCase()

  if (email === c.get('userEmail')) return c.json({ error: 'No podés borrarte a vos mismo' }, 400)
  const equipo = await listTeamMembers()
  const duenios = equipo.filter((m) => m.role === 'owner').map((m) => m.email)
  if (duenios.length === 1 && duenios[0] === email) {
    return c.json({ error: 'Es el único dueño: nombrá otro antes de borrarlo' }, 400)
  }

  await removeTeamMember(email)
  const borrado = await db().auth.admin.deleteUser(id)
  if (borrado.error) return c.json({ error: describe(borrado.error) }, 502)
  return c.json({ ok: true })
})
