import { getSettings, hasWhatsapp, TICK_MS } from '../config/settings.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { whatsapp } from '../providers/waha.js'
import { claimNextSend, markFailed, markSent, saveMessage } from '../db/queries.js'

/**
 * El carril único de salida.
 *
 * TODO lo que sale del sistema pasa por acá: respuestas del bot,
 * seguimientos, mensajes que escribe una persona desde el panel. Uno por
 * vez, con una pausa entre uno y otro.
 *
 * ────────────────────────────────────────────────────────────
 * POR QUÉ ESTO EXISTE
 *
 * Un bot que contesta al instante y en paralelo se comporta como lo que es:
 * un bot. WhatsApp lo detecta y bloquea el número. Mandar de a uno, con
 * pausas irregulares y simulando que se escribe, es lo que hace que el
 * número sobreviva.
 *
 * Es la pieza más importante del sistema y la que nadie ve.
 * ────────────────────────────────────────────────────────────
 *
 * La función claim_next_send() en la base garantiza que dos procesos no
 * agarren el mismo mensaje. Pero el RITMO depende de que haya UN solo
 * trabajador: dos réplicas son dos colas mandando en paralelo y la
 * protección desaparece. Ver docs/DEPLOY.md.
 */

let corriendo = false
let avisoSinPuente = false

function pausaAlAzar(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * Math.max(0, maxMs - minMs)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function despachar(): Promise<void> {
  // Si la vuelta anterior sigue trabajando, esta se saltea. Sin esto, un
  // envío lento se solapa con el siguiente y se pierde el ritmo.
  if (corriendo) return
  corriendo = true

  const provider = whatsapp()

  try {
    const s = await getSettings()
    if (!hasWhatsapp(s)) {
      // Sin puente, la cola espera. Se avisa una vez, no cada ocho segundos.
      if (!avisoSinPuente) {
        console.log('[envío] WhatsApp sin configurar — los mensajes esperan en la cola (panel → Conexión)')
        avisoSinPuente = true
      }
      return
    }
    avisoSinPuente = false

    const pendiente = await claimNextSend()
    if (!pendiente) return

    try {
      // Simular que se escribe. Si el puente no lo soporta, no importa.
      await provider.startTyping(pendiente.chat_id).catch(() => {})
      await pausaAlAzar(s.bot.sendPauseMinMs, s.bot.sendPauseMaxMs)
      await provider.stopTyping(pendiente.chat_id).catch(() => {})

      const { externalId } = await provider.sendText(pendiente.chat_id, pendiente.body)
      await markSent(pendiente.id)

      // Se guarda con el id que devolvió el puente. Gracias a eso, cuando
      // el eco de este mismo mensaje vuelva por el webhook, lo vamos a
      // reconocer como propio y no lo vamos a confundir con una persona
      // contestando desde el celular. (Si el eco llega antes que esto, el
      // webhook pregunta a la cola: ver recentlySentByUs.)
      if (pendiente.conversation_id) {
        await saveMessage({
          conversationId: pendiente.conversation_id,
          externalId,
          direction: 'out',
          author: pendiente.author,
          body: pendiente.body,
        })
      }
    } catch (error) {
      const detalle = describe(error)
      await markFailed(pendiente.id, pendiente.attempts, detalle)
      console.error(`[envío] falló (intento ${pendiente.attempts}):`, detalle)
      // Al tercer intento el mensaje se rinde: eso es un cliente (o el
      // grupo) que se quedó esperando algo que nunca va a llegar.
      if (pendiente.attempts >= 3) {
        logEvent({
          eventType: 'send.failed',
          severity: 'error',
          conversationId: pendiente.conversation_id,
          payload: { intentos: pendiente.attempts, error: detalle.slice(0, 300) },
        })
      }
    }
  } catch (error) {
    console.error('[envío] error al reclamar:', describe(error))
  } finally {
    corriendo = false
  }
}

export function startSendQueue(): void {
  setInterval(() => {
    void despachar()
  }, TICK_MS.send)
  console.log(`[envío] cola activa, revisando cada ${TICK_MS.send / 1000}s`)
}
