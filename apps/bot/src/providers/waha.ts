import { loadEnv, hasWhatsapp } from '../config/env.js'
import type { InboundMessage, MessageProvider } from './types.js'

/**
 * WhatsApp a través de WAHA.
 *
 * Es un puente NO oficial: por debajo maneja una sesión de WhatsApp Web.
 * Funciona muy bien y se conecta escaneando un código QR, pero implica
 * riesgo de que bloqueen el número. Por eso todo sale por la cola de envío,
 * de a uno y con pausas. Ver workers/send-queue.ts.
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
    _data?: { notifyName?: string } | null
  }
}

export class WahaProvider implements MessageProvider {
  readonly channel = 'whatsapp' as const

  private get cfg() {
    return loadEnv().whatsapp
  }

  isReady(): boolean {
    return hasWhatsapp(loadEnv())
  }

  private async call<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    const { apiUrl, apiKey } = this.cfg
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

  async sendText(chatId: string, text: string): Promise<{ externalId: string | null }> {
    const sent = await this.call<{ id?: string | { _serialized?: string } }>('/api/sendText', {
      session: this.cfg.session,
      chatId,
      text,
    })
    // El id viene como string o envuelto, según versión del puente.
    const raw = sent?.id
    const externalId = typeof raw === 'string' ? raw : (raw?._serialized ?? null)
    return { externalId }
  }

  async startTyping(chatId: string): Promise<void> {
    await this.call('/api/startTyping', { session: this.cfg.session, chatId })
  }

  async stopTyping(chatId: string): Promise<void> {
    await this.call('/api/stopTyping', { session: this.cfg.session, chatId })
  }

  async sessionStatus(): Promise<{ status: string }> {
    const res = await this.call<{ status?: string }>(
      `/api/sessions/${encodeURIComponent(this.cfg.session)}`,
      undefined,
      'GET',
    )
    return { status: res?.status ?? 'DESCONOCIDO' }
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

    const mimetype = p.media?.mimetype ?? ''
    const media = p.media?.url
      ? { url: p.media.url, kind: mimetype.split('/')[0] || 'file' }
      : null

    return {
      externalId: p.id,
      chatId,
      from: chatId.split('@')[0] ?? chatId,
      text: p.body ?? '',
      timestamp: p.timestamp ? new Date(p.timestamp * 1000) : new Date(),
      displayName: p._data?.notifyName || undefined,
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
