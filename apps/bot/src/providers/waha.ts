import { ensureWebhookSecret, getSettings, hasWhatsapp } from '../config/settings.js'
import type { InboundMessage, MessageProvider } from './types.js'

/**
 * WhatsApp a través de WAHA.
 *
 * Es un puente NO oficial: por debajo maneja una sesión de WhatsApp Web.
 * Funciona muy bien y se conecta escaneando un código QR, pero implica
 * riesgo de que bloqueen el número. Por eso todo sale por la cola de envío,
 * de a uno y con pausas. Ver workers/send-queue.ts.
 *
 * La URL, la clave y el nombre de la sesión vienen del panel (pestaña
 * Conexión), no del entorno: por eso cada llamada los pide de nuevo a
 * settings (que los tiene en caché).
 */

interface WahaEnvelope {
  event?: string
  session?: string
  payload?: {
    id?: string
    timestamp?: number
    from?: string
    to?: string
    fromMe?: boolean
    body?: string
    hasMedia?: boolean
    media?: { url?: string; mimetype?: string } | null
    _data?: { notifyName?: string; pushName?: string } | null
  }
}

export class WahaProvider implements MessageProvider {
  readonly channel = 'whatsapp' as const

  private async cfg() {
    return (await getSettings()).whatsapp
  }

  async isReady(): Promise<boolean> {
    return hasWhatsapp(await getSettings())
  }

  private async call<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    const { apiUrl, apiKey } = await this.cfg()
    if (!apiUrl) throw new Error('Falta la URL del puente de WhatsApp: cargala en el panel, pestaña Conexión')
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`WAHA ${method} ${path} respondió ${res.status}: ${detail.slice(0, 300)}`)
    }

    // Algunos endpoints contestan vacío.
    const text = await res.text()
    return (text ? JSON.parse(text) : {}) as T
  }

  /** ¿La URL y la clave son correctas? Lista las sesiones: 401 si la clave está mal. */
  async ping(): Promise<void> {
    await this.call('/api/sessions', undefined, 'GET')
  }

  async sendText(chatId: string, text: string): Promise<{ externalId: string | null }> {
    const { session } = await this.cfg()
    const sent = await this.call<{ id?: string | { _serialized?: string } }>('/api/sendText', {
      session,
      chatId,
      text,
    })
    // El id viene como string o envuelto, según versión del puente.
    const raw = sent?.id
    const externalId = typeof raw === 'string' ? raw : (raw?._serialized ?? null)
    return { externalId }
  }

  async startTyping(chatId: string): Promise<void> {
    const { session } = await this.cfg()
    await this.call('/api/startTyping', { session, chatId })
  }

  async stopTyping(chatId: string): Promise<void> {
    const { session } = await this.cfg()
    await this.call('/api/stopTyping', { session, chatId })
  }

  async sessionStatus(): Promise<{ status: string }> {
    const { session } = await this.cfg()
    const res = await this.call<{ status?: string }>(
      `/api/sessions/${encodeURIComponent(session)}`,
      undefined,
      'GET',
    )
    return { status: res?.status ?? 'DESCONOCIDO' }
  }

  /**
   * Crea (o reinicia) la sesión de WhatsApp, dejando el webhook apuntado
   * al servidor. Después de esto la sesión queda esperando el escaneo del
   * QR — ver qrImage().
   *
   * El secreto lo genera el servidor (ver settings.ts) y viaja como query
   * del webhook porque es lo único que funciona igual en cualquier
   * versión del puente; el webhook lo acepta por query o por header.
   */
  async startSession(webhookUrl: string): Promise<void> {
    const { session } = await this.cfg()
    const secret = await ensureWebhookSecret()
    const url = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}secret=${encodeURIComponent(secret)}`
    const body = {
      name: session,
      start: true,
      config: {
        webhooks: [{ url, events: ['message', 'message.any'] }],
      },
    }
    try {
      await this.call('/api/sessions', body)
    } catch {
      // Ya existía: reiniciarla alcanza (y si el número estaba deslogueado,
      // vuelve a pedir QR).
      await this.call(`/api/sessions/${encodeURIComponent(session)}/restart`)
    }
  }

  /**
   * El código QR para vincular el número, como data-url lista para un
   * <img>. Devuelve null si la sesión no está pidiendo QR en este momento
   * (ya vinculada, o todavía arrancando).
   */
  async qrImage(): Promise<string | null> {
    const { apiUrl, apiKey, session } = await this.cfg()
    const res = await fetch(
      `${apiUrl}/api/${encodeURIComponent(session)}/auth/qr?format=image`,
      { headers: { 'X-Api-Key': apiKey, Accept: 'image/png' } },
    )
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:image/png;base64,${buf.toString('base64')}`
  }

  /**
   * Los grupos del número conectado, para elegir el de avisos desde una
   * lista. Nadie sabe el id interno de su grupo; el nombre sí.
   */
  async listGroups(): Promise<Array<{ id: string; name: string }>> {
    const { session } = await this.cfg()
    const res = await this.call<Array<{ id: string; subject?: string; name?: string }>>(
      `/api/${encodeURIComponent(session)}/groups?exclude=participants`,
      undefined,
      'GET',
    )
    return (Array.isArray(res) ? res : []).map((g) => ({ id: g.id, name: g.subject || g.name || g.id }))
  }

  parseWebhook(payload: unknown): InboundMessage | null {
    const env = payload as WahaEnvelope
    // 'message' son los del cliente; 'message.any' incluye los del negocio,
    // que es como nos enteramos de que alguien contestó desde el celular.
    if (env?.event !== 'message' && env?.event !== 'message.any') return null

    const p = env.payload
    if (!p?.id) return null

    const isEcho = Boolean(p.fromMe)
    // En un eco, el chat del cliente es el destinatario, no el remitente.
    const chatId = (isEcho ? p.to : p.from) ?? ''
    if (!chatId) return null

    // Grupos, estados y canales no son conversaciones de clientes. El
    // grupo de avisos del negocio entra por acá: sin este corte, el bot
    // crea una "conversación" con el grupo y le contesta al equipo.
    if (chatId.endsWith('@g.us') || chatId.endsWith('@broadcast') || chatId.endsWith('@newsletter')) {
      return null
    }

    // Aunque el puente no haya bajado el archivo, saber que HAY uno
    // importa: el turno le dice al modelo "mandó una imagen" en vez de
    // pasarle un mensaje vacío.
    const mimetype = p.media?.mimetype ?? ''
    const media = p.hasMedia || p.media?.url
      ? { url: p.media?.url ?? '', kind: mimetype.split('/')[0] || 'file' }
      : null

    return {
      externalId: p.id,
      chatId,
      from: chatId.split('@')[0] ?? chatId,
      text: p.body ?? '',
      timestamp: p.timestamp ? new Date(p.timestamp * 1000) : new Date(),
      // notifyName es de WEBJS; pushName de NOWEB y GOWS.
      displayName: p._data?.notifyName || p._data?.pushName || undefined,
      media,
      isEcho,
    }
  }
}

let cached: WahaProvider | null = null

export function whatsapp(): WahaProvider {
  if (!cached) cached = new WahaProvider()
  return cached
}
