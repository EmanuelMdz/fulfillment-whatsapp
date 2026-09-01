/**
 * Todo el acceso a datos del bot, en un solo archivo.
 *
 * Si una consulta se usa en dos lugares, va acá. Si aparece un `.from(...)`
 * suelto en un worker o en una ruta, algo se hizo mal.
 */

import { db } from './client.js'

export interface Conversation {
  id: string
  contact_id: string | null
  channel: string
  chat_id: string
  state: 'bot' | 'humano' | 'cerrado'
  respond_after: string | null
  last_inbound_id: string | null
  human_at: string | null
  handback_at: string | null
}

export interface QueuedSend {
  id: string
  conversation_id: string | null
  channel: string
  chat_id: string
  body: string
  author: 'bot' | 'human'
  attempts: number
}

export interface HistoryMessage {
  author: 'customer' | 'bot' | 'human'
  body: string
}

/** Busca la conversación de este chat, o la crea junto con su contacto. */
export async function findOrCreateConversation(
  channel: string,
  chatId: string,
  displayName?: string,
): Promise<Conversation> {
  const existing = await db()
    .from('conversations')
    .select('*')
    .eq('channel', channel)
    .eq('chat_id', chatId)
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data) return existing.data as Conversation

  const phone = chatId.split('@')[0] ?? chatId
  const contact = await db()
    .from('contacts')
    .upsert({ phone, name: displayName ?? '' }, { onConflict: 'phone' })
    .select('id')
    .single()
  if (contact.error) throw contact.error

  const created = await db()
    .from('conversations')
    .insert({ channel, chat_id: chatId, contact_id: contact.data.id })
    .select('*')
    .single()

  // Si dos mensajes del mismo chat entran a la vez, uno gana y el otro
  // choca contra el unique. No es un error: se relee y listo.
  if (created.error) {
    const retry = await db()
      .from('conversations')
      .select('*')
      .eq('channel', channel)
      .eq('chat_id', chatId)
      .single()
    if (retry.error) throw created.error
    return retry.data as Conversation
  }

  return created.data as Conversation
}

/** ¿Este mensaje ya está guardado? Así sabemos si un eco lo mandamos nosotros. */
export async function findMessageByExternalId(
  conversationId: string,
  externalId: string,
): Promise<{ id: string; author: string } | null> {
  const res = await db()
    .from('messages')
    .select('id, author')
    .eq('conversation_id', conversationId)
    .eq('external_id', externalId)
    .maybeSingle()
  if (res.error) throw res.error
  return res.data as { id: string; author: string } | null
}

export async function saveMessage(input: {
  conversationId: string
  externalId?: string | null
  direction: 'in' | 'out'
  author: 'customer' | 'bot' | 'human'
  body: string
  mediaUrl?: string | null
  mediaKind?: string | null
  providerTs?: Date | null
}): Promise<string | null> {
  const res = await db()
    .from('messages')
    .insert({
      conversation_id: input.conversationId,
      external_id: input.externalId ?? null,
      direction: input.direction,
      author: input.author,
      body: input.body,
      media_url: input.mediaUrl ?? null,
      media_kind: input.mediaKind ?? null,
      provider_ts: input.providerTs?.toISOString() ?? null,
    })
    .select('id')
    .single()

  // El webhook puede repetir un mensaje. Chocar contra el unique acá es
  // exactamente lo que queremos que pase.
  if (res.error) return null
  return res.data.id as string
}

/**
 * Agenda el turno: dentro de `seconds` hay que contestar.
 *
 * Guarda cuál fue el último mensaje entrante. Cuando llegue la hora, si ya
 * no es el último, es porque el cliente siguió escribiendo: ese turno se
 * descarta y contesta el siguiente, con todo junto.
 */
export async function scheduleTurn(
  conversationId: string,
  lastInboundId: string | null,
  seconds: number,
): Promise<void> {
  const at = new Date(Date.now() + seconds * 1000).toISOString()
  const res = await db()
    .from('conversations')
    .update({ respond_after: at, last_inbound_id: lastInboundId })
    .eq('id', conversationId)
  if (res.error) throw res.error
}

/**
 * Alguien del negocio contestó a mano: el bot se calla.
 *
 * No toca `handback_at`: cuando lo devuelvan al bot, se compara contra eso
 * para que un mensaje humano viejo no lo vuelva a pausar.
 */
export async function pauseForHuman(conversationId: string): Promise<void> {
  const res = await db()
    .from('conversations')
    .update({ state: 'humano', human_at: new Date().toISOString(), respond_after: null })
    .eq('id', conversationId)
  if (res.error) throw res.error
}

/** El último mensaje entrante guardado de esta conversación. */
export async function lastInboundId(conversationId: string): Promise<string | null> {
  const res = await db()
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('direction', 'in')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (res.error) throw res.error
  return (res.data?.id as string) ?? null
}

/** Historial reciente, del más viejo al más nuevo, para armar el contexto. */
export async function history(conversationId: string, limit = 20): Promise<HistoryMessage[]> {
  const res = await db()
    .from('messages')
    .select('author, body')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (res.error) throw res.error
  return ((res.data ?? []) as HistoryMessage[]).reverse()
}

/** Prompts, con el del canal pisando al general si existe. */
export async function getPrompts(channel: string): Promise<Record<string, string>> {
  const res = await db().from('prompts').select('section, channel, content')
  if (res.error) throw res.error

  const out: Record<string, string> = {}
  for (const row of (res.data ?? []) as Array<{ section: string; channel: string | null; content: string }>) {
    if (row.channel === null) out[row.section] ??= row.content
  }
  for (const row of (res.data ?? []) as Array<{ section: string; channel: string | null; content: string }>) {
    if (row.channel === channel) out[row.section] = row.content
  }
  return out
}

export interface CatalogItem {
  id: string
  name: string
  price: number
  description: string
  bot_info: string
}

/** El catálogo activo, con la ficha que la IA puede contar. */
export async function getCatalog(): Promise<CatalogItem[]> {
  const res = await db()
    .from('catalog_items')
    .select('id, name, price, description, bot_info')
    .eq('active', true)
    .order('sort')
  if (res.error) throw res.error
  return (res.data ?? []) as CatalogItem[]
}

export interface AppConfig {
  pack: string
  business_name: string
  timezone: string
  labels: Record<string, string>
  order_stages: Array<{ key: string; label: string; final: boolean }>
  escalation_reasons: Array<{ key: string; label: string }>
  business_hours: Record<string, unknown>
  notify_chat_id: string | null
  /** Llave general: en false, el bot no contesta nada (los mensajes se guardan igual). */
  bot_enabled: boolean
}

/** La fila única de configuración. Si falta (instalación a medias), valores vacíos. */
export async function getConfig(): Promise<AppConfig> {
  const res = await db().from('app_config').select('*').eq('id', 1).maybeSingle()
  if (res.error) throw res.error
  return (
    (res.data as AppConfig) ?? {
      pack: 'ecommerce',
      business_name: '',
      timezone: 'America/Montevideo',
      labels: {},
      order_stages: [],
      escalation_reasons: [],
      business_hours: {},
      notify_chat_id: null,
      bot_enabled: true,
    }
  )
}

// ── Control de la conversación ───────────────────────────────

/**
 * Una conversación cerrada a la que el cliente vuelve a escribir se
 * reabre sola: "cerrado" significa "terminó", no "no atender". Descartar
 * a alguien es una decisión humana, y se toma desde el panel.
 */
export async function reopenConversation(conversationId: string): Promise<void> {
  const res = await db()
    .from('conversations')
    .update({ state: 'bot' })
    .eq('id', conversationId)
  if (res.error) throw res.error
}

/**
 * Devolver la conversación al bot.
 *
 * `handback_at` es el corte: la evidencia humana ANTERIOR a esta marca ya
 * no cuenta para volver a pausar el bot. Sin esto, la conversación rebota
 * entre humano y bot para siempre — el eco viejo de la persona la vuelve
 * a pausar apenas se la devolvés.
 */
export async function handbackToBot(conversationId: string): Promise<void> {
  const res = await db()
    .from('conversations')
    .update({ state: 'bot', handback_at: new Date().toISOString() })
    .eq('id', conversationId)
  if (res.error) throw res.error
}

// ── Cola de revisión ─────────────────────────────────────────

/**
 * Deja la conversación en la bandeja del equipo. Si ya tenía un caso
 * abierto, el índice único lo rebota y no pasa nada: tres guardas
 * escalando el mismo chat siguen siendo UNA fila en la cola.
 * Devuelve true si el caso es nuevo.
 */
export async function queueReview(
  conversationId: string,
  reason: string,
  detail: string,
): Promise<boolean> {
  const res = await db()
    .from('review_queue')
    .insert({ conversation_id: conversationId, reason, detail })
  if (!res.error) return true
  if (res.error.code === '23505') return false
  throw res.error
}

/** El estado actual de una conversación, o null si no existe. */
export async function getConversationById(conversationId: string): Promise<Conversation | null> {
  const res = await db()
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle()
  if (res.error) throw res.error
  return (res.data as Conversation) ?? null
}

// ── Seguimientos ─────────────────────────────────────────────

export interface Followup {
  id: string
  conversation_id: string
  message: string
  scheduled_at: string
  status: 'pending' | 'sent' | 'cancelled' | 'failed'
}

export async function scheduleFollowup(
  conversationId: string,
  message: string,
  scheduledAtIso: string,
): Promise<void> {
  const res = await db()
    .from('followups')
    .insert({ conversation_id: conversationId, message, scheduled_at: scheduledAtIso })
  if (res.error) throw res.error
}

/**
 * Cancela los recordatorios pendientes. Se llama cada vez que el cliente
 * escribe (la conversación revivió sola) y cada vez que el chat pasa a
 * una persona (un recordatorio del bot en el medio de una atención humana
 * pisa a la persona).
 */
export async function cancelPendingFollowups(conversationId: string): Promise<void> {
  const res = await db()
    .from('followups')
    .update({ status: 'cancelled' })
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
  if (res.error) throw res.error
}

/** Los recordatorios vencidos, ya reclamados (ver claim_due_followups en 0005). */
export async function claimDueFollowups(max = 5): Promise<Followup[]> {
  const res = await db().rpc('claim_due_followups', { max_batch: max })
  if (res.error) throw res.error
  return (res.data ?? []) as Followup[]
}

export async function markFollowupStatus(
  id: string,
  status: 'cancelled' | 'failed',
): Promise<void> {
  await db().from('followups').update({ status }).eq('id', id)
}

/** Lo ya enviado, para que el próximo recordatorio no repita el ángulo. */
export async function getSentFollowupMessages(conversationId: string): Promise<string[]> {
  const res = await db()
    .from('followups')
    .select('message')
    .eq('conversation_id', conversationId)
    .eq('status', 'sent')
    .order('created_at', { ascending: true })
  if (res.error) return []
  return ((res.data ?? []) as Array<{ message: string }>).map((r) => r.message)
}

// ── Pedidos que arma el bot ──────────────────────────────────

export interface BotOrderItem {
  catalog_item_id: string
  name: string
  qty: number
  unit_price: number
}

/**
 * Crea el pedido que la IA armó en el chat. Nace en la PRIMERA etapa del
 * negocio (nunca en una final): el bot lo anota, una persona lo confirma.
 * Los precios vienen del catálogo, jamás de lo que dijo el modelo.
 */
export async function createBotOrder(input: {
  contactId: string | null
  items: BotOrderItem[]
  total: number
  stage: string
  notes: string
}): Promise<string> {
  const res = await db()
    .from('orders')
    .insert({
      contact_id: input.contactId,
      items: input.items,
      total: input.total,
      stage: input.stage,
      source: 'bot',
      notes: input.notes,
    })
    .select('id')
    .single()
  if (res.error) throw res.error
  return res.data.id as string
}

/**
 * ¿Este contacto ya tiene un pedido del bot sin terminar? Evita que un
 * "sí, dale" repetido diez mensajes después arme el MISMO pedido dos
 * veces. `finalStages` son las etapas terminales del negocio: lo que no
 * está en una de esas sigue vivo.
 */
export async function findOpenBotOrder(
  contactId: string,
  finalStages: string[],
): Promise<{ id: string; stage: string } | null> {
  let query = db()
    .from('orders')
    .select('id, stage')
    .eq('contact_id', contactId)
    .eq('source', 'bot')
  if (finalStages.length) {
    query = query.not('stage', 'in', `(${finalStages.map((s) => `"${s}"`).join(',')})`)
  }
  const res = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (res.error) throw res.error
  return (res.data as { id: string; stage: string }) ?? null
}

// ── Ficha del contacto ───────────────────────────────────────

/**
 * Mergea los datos que la IA fue juntando en la conversación (nombre,
 * dirección, lo que sea) dentro de `contacts.collected`. Es la ficha que
 * pre-llena el formulario cuando se crea un pedido desde el chat.
 *
 * Lo nuevo pisa lo viejo clave por clave — el cliente que corrige su
 * dirección tres veces se queda con la última, no con la primera.
 * Y si el contacto todavía no tiene nombre, lo bautiza con el real.
 */
export async function mergeCollectedData(
  contactId: string,
  data: Record<string, string>,
): Promise<void> {
  const actual = await db()
    .from('contacts')
    .select('name, collected')
    .eq('id', contactId)
    .maybeSingle()
  if (actual.error) throw actual.error
  if (!actual.data) return

  const merged = { ...((actual.data.collected as Record<string, string>) ?? {}), ...data }
  const cambios: Record<string, unknown> = { collected: merged }
  if (data.nombre_completo && !(actual.data.name as string)?.trim()) {
    cambios.name = data.nombre_completo
  }

  const res = await db().from('contacts').update(cambios).eq('id', contactId)
  if (res.error) throw res.error
}

// ── Avisos al grupo ──────────────────────────────────────────

/**
 * Reclama el episodio de un aviso ANTES de mandarlo.
 *
 * true  → episodio nuevo: el que llama DEBE avisar.
 * false → este episodio ya avisó: no se manda nada.
 *
 * Un error inesperado de la base devuelve true a propósito (fail-open):
 * el grupo puede ignorar un aviso repetido, pero un aviso que se pierde
 * — una venta esperando, un cliente mudo — no se recupera nunca.
 */
export async function claimNotificationEpisode(
  scope: string,
  kind: string,
  episodeKey: string,
): Promise<boolean> {
  const res = await db()
    .from('notification_episodes')
    .insert({ scope, kind, episode_key: episodeKey })
  if (!res.error) return true
  if (res.error.code === '23505') return false
  console.warn('[avisos] no se pudo reclamar el episodio (se avisa igual):', res.error.message)
  return true
}

/** El texto del último mensaje del cliente, para incluirlo en un aviso. */
export async function lastInboundPreview(conversationId: string): Promise<string | null> {
  const res = await db()
    .from('messages')
    .select('body')
    .eq('conversation_id', conversationId)
    .eq('direction', 'in')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (res.error) return null
  return (res.data?.body as string) ?? null
}

// ── Cola de envío ────────────────────────────────────────────

/**
 * Nadie manda mensajes: los escribe acá y el trabajador los saca de a uno.
 * `conversationId` en null es un mensaje que no pertenece a ningún chat de
 * cliente — por ejemplo, un aviso al grupo del negocio.
 */
export async function enqueueSend(input: {
  conversationId: string | null
  channel: string
  chatId: string
  body: string
  author?: 'bot' | 'human'
}): Promise<void> {
  const res = await db().from('send_queue').insert({
    conversation_id: input.conversationId,
    channel: input.channel,
    chat_id: input.chatId,
    body: input.body,
    author: input.author ?? 'bot',
  })
  if (res.error) throw res.error
}

export async function claimNextSend(): Promise<QueuedSend | null> {
  const res = await db().rpc('claim_next_send')
  if (res.error) throw res.error
  const rows = (res.data ?? []) as QueuedSend[]
  return rows[0] ?? null
}

export async function markSent(id: string): Promise<void> {
  await db().from('send_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
}

/** Falla: vuelve a la cola hasta el tercer intento, después se rinde. */
export async function markFailed(id: string, attempts: number, error: string): Promise<void> {
  await db()
    .from('send_queue')
    .update({
      status: attempts >= 3 ? 'failed' : 'pending',
      last_error: error.slice(0, 500),
    })
    .eq('id', id)
}

export async function claimDueTurns(max = 5): Promise<Conversation[]> {
  const res = await db().rpc('claim_due_turns', { max_batch: max })
  if (res.error) throw res.error
  return (res.data ?? []) as Conversation[]
}
