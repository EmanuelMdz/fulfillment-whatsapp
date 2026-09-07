import { db } from '../db/client.js'

/**
 * Registro de eventos: la memoria de lo que el sistema hizo y por qué.
 *
 * Cuando alguien pregunte "¿por qué el bot no contestó acá?" tres días
 * después, la respuesta está en la tabla `event_log`, no en el recuerdo
 * de nadie. Cada pieza del sistema deja su rastro con `logEvent()`.
 *
 * Dos decisiones de diseño que conviene entender:
 *
 * 1. EL CATÁLOGO ES CERRADO. Un evento nuevo se agrega a `EVENT_TYPES` o
 *    TypeScript no compila. Sin esto, cada archivo inventa sus propios
 *    nombres ("turnFailed", "turn_error", "fallo-turno") y la tabla se
 *    vuelve imposible de consultar.
 *
 * 2. GRABAR NUNCA PUEDE ROMPER EL FLUJO. El insert va sin await y si
 *    falla solo lo escribe en la consola. Perder un evento cuesta poco;
 *    dejar a un cliente sin respuesta porque falló la telemetría cuesta
 *    una venta.
 *
 * Acá va el RESUMEN estructurado (ids, cantidades, motivos) — nunca el
 * texto del cliente, que ya vive en `messages`.
 */

export const EVENT_TYPES = [
  // El ciclo del turno.
  'turn.answered',        // el bot contestó
  'turn.superseded',      // llegó otro mensaje mientras esperaba: turno descartado
  'turn.skipped',         // el turno no corrió (payload.motivo dice por qué)
  'turn.failed',          // el turno murió con error — el cliente quedó sin respuesta

  // Quién tiene el control de la conversación.
  'conversation.human_takeover', // alguien del negocio contestó a mano: el bot se calla
  'conversation.handback',       // devolvieron la conversación al bot
  'conversation.reopened',       // estaba cerrada y el cliente volvió a escribir

  // Guardas: el código frenó algo que el modelo quería hacer.
  'guardrail.loop',       // el bot mandó lo mismo 3 veces seguidas
  'guardrail.repeat',     // la respuesta nueva repetía lo recién dicho

  // La cola de envío.
  'send.failed',          // un mensaje agotó sus intentos y no salió

  // Avisos al grupo del negocio.
  'notification.queued',  // el aviso entró a la cola de envío
  'notification.deduped', // este episodio ya avisó — no se repite
  'notification.skipped', // no hay grupo configurado para avisar

  // Derivación a una persona (cola de revisión).
  'review.queued',

  // Pedidos que arma el bot.
  'order.created',
  'order.failed',

  // Seguimientos automáticos.
  'followup.scheduled',
  'followup.sent',
  'followup.dropped',

  // La conexión del número. Un bot desconectado es un negocio sin
  // atender: por eso queda registrado cuándo se cayó y cuándo volvió.
  'whatsapp.connected',
  'whatsapp.disconnected',

  // Tareas programadas.
  'cron.completed',
  'cron.error',

  // Lo que no encaja en nada de lo anterior.
  'internal.error',
] as const

export type EventType = (typeof EVENT_TYPES)[number]
export type EventSeverity = 'info' | 'warn' | 'error'

export interface LogEventInput {
  eventType: EventType
  severity?: EventSeverity
  conversationId?: string | null
  /** Resumen estructurado. Nada de texto libre del cliente. */
  payload?: Record<string, unknown>
}

/** Graba el evento. No hace falta esperar el resultado — y no hay que hacerlo. */
export function logEvent(input: LogEventInput): void {
  const severity = input.severity ?? 'info'
  const payload = input.payload ?? {}

  // A la consola siempre: es lo que se ve en los registros del hosting
  // en vivo, aunque la base esté lenta o caída.
  const linea = `[evento] ${input.eventType} ${JSON.stringify(payload)}`
  if (severity === 'error') console.error(linea)
  else if (severity === 'warn') console.warn(linea)
  else console.log(linea)

  // A la base sin bloquear a nadie. Si falla, queda en consola y listo.
  void db()
    .from('event_log')
    .insert({
      conversation_id: input.conversationId ?? null,
      event_type: input.eventType,
      severity,
      payload,
    })
    .then(({ error }) => {
      if (error) console.error(`[evento] no se pudo grabar ${input.eventType}:`, error.message)
    })
}
