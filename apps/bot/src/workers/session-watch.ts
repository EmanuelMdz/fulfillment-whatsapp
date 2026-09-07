import { getSettings, hasWhatsapp } from '../config/settings.js'
import { describe } from '../utils/errors.js'
import { logEvent } from '../observability/events.js'
import { whatsapp } from '../providers/waha.js'
import { updateConfig } from '../db/queries.js'

/**
 * El vigilante de la conexión.
 *
 * ────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 *
 * Un número se desconecta solo: alguien cierra la sesión desde el
 * teléfono, el puente se redesplega sin volumen, WhatsApp corta la
 * vinculación. Cuando pasa, el bot queda MUDO y el negocio no se
 * entera — porque el aviso al grupo sale por el mismo WhatsApp que se
 * cayó. Ese silencio puede durar días.
 *
 * Este trabajador mira el estado de la sesión cada dos minutos y lo
 * guarda en `app_config`. El panel lo lee y lo muestra en rojo arriba
 * de todo, y el registro de eventos deja la marca de cuándo se cayó y
 * cuándo volvió.
 * ────────────────────────────────────────────────────────────
 */

const TICK_MS = 120_000

/** El único estado que significa "el bot está atendiendo". */
const CONECTADO = 'WORKING'

let corriendo = false
let ultimo: string | null = null

async function tick(): Promise<void> {
  if (corriendo) return
  corriendo = true

  try {
    const s = await getSettings()
    if (!hasWhatsapp(s)) {
      // Sin puente configurado no hay nada que vigilar: el panel ya
      // muestra "WhatsApp sin configurar" por otro lado.
      if (ultimo !== null) ultimo = null
      return
    }

    let estado: string
    try {
      estado = (await whatsapp().sessionStatus()).status
    } catch (err) {
      // El puente no contesta: eso TAMBIÉN es estar desconectado, y es
      // de los casos más comunes (el servicio del puente se cayó).
      estado = 'SIN_RESPUESTA'
      console.warn('[conexión] el puente no contesta:', describe(err))
    }

    if (estado === ultimo) return

    // El estado cambió: se guarda para el panel y se anota el evento.
    const antes = ultimo
    ultimo = estado
    await updateConfig({ whatsapp_status: estado, whatsapp_status_at: new Date().toISOString() })

    // En el primer arranque no hay "antes": se guarda el estado, pero no
    // se anuncia una caída que quizá venga de ayer.
    if (antes === null) {
      console.log(`[conexión] estado de la sesión: ${estado}`)
      return
    }

    if (estado === CONECTADO) {
      console.log('[conexión] el número volvió a estar conectado')
      logEvent({ eventType: 'whatsapp.connected', payload: { desde: antes } })
    } else {
      console.error(`[conexión] EL NÚMERO SE DESCONECTÓ (${antes} → ${estado}): el bot no puede contestar`)
      logEvent({
        eventType: 'whatsapp.disconnected',
        severity: 'error',
        payload: { antes, ahora: estado },
      })
    }
  } catch (error) {
    console.error('[conexión] error al vigilar la sesión:', describe(error))
  } finally {
    corriendo = false
  }
}

export function startSessionWatch(): void {
  // La primera mirada al toque: si el servidor arranca con el número
  // caído, el panel lo muestra sin esperar dos minutos.
  void tick()
  setInterval(() => {
    void tick()
  }, TICK_MS)
  console.log(`[conexión] vigilando la sesión cada ${TICK_MS / 1000}s`)
}
