import { loadEnv } from '../config/env.js'
import { logEvent } from '../observability/events.js'
import { claimNotificationEpisode, enqueueSend, getConfig } from '../db/queries.js'

/**
 * Avisos al grupo del negocio.
 *
 * El bot atiende solo, pero hay momentos en los que una persona TIENE que
 * enterarse: alguien pidió hablar con un humano, hay un pedido esperando
 * aprobación, el bot no pudo contestar. Eso sale como un mensaje de
 * WhatsApp al grupo configurado en `app_config.notify_chat_id`.
 *
 * ────────────────────────────────────────────────────────────
 * LA REGLA DE ORO: UN EPISODIO, UN AVISO
 *
 * Los turnos se re-ejecutan (un reinicio, un reintento, dos mensajes
 * seguidos) y cada re-ejecución vuelve a pasar por el punto que avisa.
 * Sin protección, el grupo recibe el mismo aviso tres veces y a la
 * semana nadie lo mira más — y ahí se pierde el aviso que importaba.
 *
 * Por eso cada aviso reclama primero su EPISODIO en la base (tabla
 * `notification_episodes`, con clave única). Si la fila ya existía, ese
 * episodio ya avisó y no se manda nada. La clave se arma con el
 * DISPARADOR (el id del mensaje que causó el aviso, la fecha del
 * resumen), nunca con "ahora": así la repetición accidental es imposible
 * por construcción y un re-aviso deliberado sigue siendo posible con
 * una clave distinta.
 * ────────────────────────────────────────────────────────────
 *
 * El aviso sale por la MISMA cola de envío que todo lo demás (regla del
 * repo: nadie manda mensajes directamente). Un aviso puede tardar unos
 * segundos en salir; para un grupo interno no importa, y a cambio hereda
 * los reintentos y el ritmo que protege al número.
 */

/**
 * Limpia un texto que va adentro de un aviso: saca caracteres de control,
 * aplasta saltos de línea y recorta. Sin esto, un mensaje del cliente con
 * veinte renglones rompe el formato del aviso y el grupo deja de leerlo.
 */
export function sanitizeVar(input: string | null | undefined, maxLen = 120): string {
  if (input == null) return '—'
  let s = String(input)
    .replace(/[\r\n\t]+/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return '—'
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + '…'
  return s
}

/**
 * Link a la conversación en el panel. WhatsApp solo hace clickeable lo
 * que empieza con http(s)://, así que sin PUBLIC_URL no se manda nada:
 * un path suelto en el grupo es un link roto que hay que copiar a mano.
 */
export function conversationLink(conversationId: string): string {
  const base = loadEnv().publicUrl
  if (!base) return ''
  return `${base}/conversaciones?id=${conversationId}`
}

export interface NoticeInput {
  /** Qué clase de aviso es. Va en la clave del episodio. */
  kind: string
  /** Clave del episodio: derivada del disparador, no del momento. */
  episodeKey: string
  /** Conversación a la que refiere, si hay una. */
  conversationId?: string | null
  /** Renglones del aviso. Los vacíos se descartan. */
  lines: string[]
}

/**
 * Manda un aviso al grupo, una sola vez por episodio.
 * Devuelve true si el aviso entró a la cola en esta llamada.
 */
export async function sendGroupNotice(input: NoticeInput): Promise<boolean> {
  const config = await getConfig()

  if (!config.notify_chat_id) {
    logEvent({
      eventType: 'notification.skipped',
      conversationId: input.conversationId ?? null,
      payload: { kind: input.kind, motivo: 'sin grupo configurado' },
    })
    return false
  }

  const scope = input.conversationId ?? 'global'
  const fresh = await claimNotificationEpisode(scope, input.kind, input.episodeKey)
  if (!fresh) {
    logEvent({
      eventType: 'notification.deduped',
      conversationId: input.conversationId ?? null,
      payload: { kind: input.kind, episode_key: input.episodeKey },
    })
    return false
  }

  await enqueueSend({
    conversationId: null,
    channel: 'whatsapp',
    chatId: config.notify_chat_id,
    body: input.lines.filter(Boolean).join('\n'),
  })

  logEvent({
    eventType: 'notification.queued',
    conversationId: input.conversationId ?? null,
    payload: { kind: input.kind, episode_key: input.episodeKey },
  })
  return true
}

/**
 * La conversación cayó en la cola de revisión: alguien del equipo tiene
 * que mirarla. `reasonLabel` es el motivo en palabras del negocio (viene
 * de app_config.escalation_reasons o de una guarda del código).
 */
export async function notifyReview(params: {
  conversationId: string
  chatId: string
  reasonLabel: string
  lastMessage?: string
  /** Derivada del mensaje que disparó la escalada: re-ejecutar no re-avisa. */
  episodeKey: string
}): Promise<boolean> {
  const link = conversationLink(params.conversationId)
  return sendGroupNotice({
    kind: 'revision',
    episodeKey: params.episodeKey,
    conversationId: params.conversationId,
    lines: [
      `🖐️ Necesita una persona: ${sanitizeVar(params.chatId.split('@')[0], 40)}`,
      `Motivo: ${sanitizeVar(params.reasonLabel, 160)}`,
      params.lastMessage ? `Último mensaje: ${sanitizeVar(params.lastMessage, 100)}` : '',
      link,
    ],
  })
}

/**
 * Hay un pedido esperando que alguien lo confirme. Es EL aviso que mueve
 * plata: el cliente ya dijo que sí y está esperando — cada hora que pasa
 * sin confirmarlo enfría la venta.
 */
export async function notifyOrderPending(params: {
  conversationId: string
  chatId: string
  /** Cómo se llama un pedido en este negocio ("Venta", "Consulta"…). */
  orderLabel: string
  summary: string
  episodeKey: string
}): Promise<boolean> {
  const link = conversationLink(params.conversationId)
  return sendGroupNotice({
    kind: 'pedido_pendiente',
    episodeKey: params.episodeKey,
    conversationId: params.conversationId,
    lines: [
      `💰 ${sanitizeVar(params.orderLabel, 30)} para CONFIRMAR: ${sanitizeVar(params.chatId.split('@')[0], 40)}`,
      // El resumen es multilínea (un renglón por item): se limpia renglón
      // por renglón para no aplastarlo.
      ...params.summary.split('\n').map((l) => sanitizeVar(l, 160)),
      'Revisalo y confirmáselo al cliente desde el panel:',
      link,
    ],
  })
}

/**
 * URGENTE: el turno se cayó y el cliente quedó MUDO.
 *
 * Este aviso existe porque el error silencioso es el peor de todos: el
 * cliente escribe, el bot falla antes de contestar, y nadie del negocio
 * se entera jamás — el cliente termina yéndose después de escribir tres
 * veces sin respuesta. Si el bot no pudo hablar, que hable el grupo.
 */
export async function notifyTurnFailed(params: {
  conversationId: string
  chatId: string
  errorMessage: string
  lastMessage?: string
  /** El id del mensaje que disparó el turno: la re-ejecución no re-avisa. */
  episodeKey: string
}): Promise<boolean> {
  const link = conversationLink(params.conversationId)
  return sendGroupNotice({
    kind: 'turno_caido',
    episodeKey: params.episodeKey,
    conversationId: params.conversationId,
    lines: [
      `🚨 EL BOT NO PUDO CONTESTAR: ${sanitizeVar(params.chatId.split('@')[0], 40)}`,
      'El cliente escribió y quedó sin respuesta. Contestale a mano.',
      params.lastMessage ? `Último mensaje: ${sanitizeVar(params.lastMessage, 100)}` : '',
      `Falla: ${sanitizeVar(params.errorMessage, 140)}`,
      link,
    ],
  })
}
