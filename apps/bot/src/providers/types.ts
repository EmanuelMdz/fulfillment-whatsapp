/**
 * El contrato que cumple cada canal.
 *
 * El resto del sistema no sabe si está hablando por WhatsApp o por
 * Instagram: pide "mandá este texto a este chat" y listo. Sumar un canal
 * es escribir un archivo acá y agregarlo a `Channel` — nada más.
 *
 * Instagram entra por esta misma puerta cuando sea su momento.
 * Ver la decisión 8 en docs/DECISIONES.md.
 */

export type Channel = 'whatsapp'

/** Un mensaje entrante, ya traducido a algo que el sistema entiende. */
export interface InboundMessage {
  /** Id del mensaje del lado del proveedor. Sirve para no duplicar. */
  externalId: string
  /** Id del chat del lado del proveedor. */
  chatId: string
  /** Teléfono o identificador de la persona, si se puede saber. */
  from: string
  text: string
  timestamp: Date
  /** Nombre que muestra la persona, si viene. */
  displayName?: string
  media?: { url: string; kind: string } | null
  /**
   * true = lo mandó el negocio, no el cliente.
   *
   * Quién de los dos lo mandó —nosotros por la API, o una persona desde el
   * celular— NO lo decide el proveedor: lo decide el webhook mirando si ese
   * id ya está guardado como enviado por nosotros. Si no está, lo escribió
   * un humano y el bot se calla. Así funciona igual en cualquier canal, sin
   * depender de campos internos de cada puente.
   */
  isEcho: boolean
}

export interface MessageProvider {
  readonly channel: Channel
  /** ¿Está configurado y listo para usar? (Lee la configuración del panel.) */
  isReady(): Promise<boolean>
  sendText(chatId: string, text: string): Promise<{ externalId: string | null }>
  startTyping(chatId: string): Promise<void>
  stopTyping(chatId: string): Promise<void>
  /** Estado de la sesión, para la pantalla de conexión. */
  sessionStatus(): Promise<{ status: string }>
  /** Traduce lo que llegó por el webhook. Devuelve null si no interesa. */
  parseWebhook(payload: unknown): InboundMessage | null
}
