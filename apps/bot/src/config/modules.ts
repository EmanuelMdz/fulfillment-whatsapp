import { MODULES } from '@fw/core'
import { getEnabledModules } from '../db/queries.js'

/**
 * El corte de los módulos en el servidor.
 *
 * Cada paso opcional del pipeline (leer una imagen, transcribir un
 * audio, descontar stock, armar un link de pago) empieza preguntando
 * acá. Si el módulo está apagado, el paso no corre: no consulta nada, no
 * pide claves y no aparece en el prompt.
 *
 * ¿Por qué una caché de treinta segundos y no leer la tabla siempre?
 * Porque un solo turno del bot puede preguntar por cuatro módulos, y
 * cuatro consultas por mensaje a una base compartida es una cuenta que
 * se paga sin necesidad. ¿Por qué treinta y no para siempre? Porque el
 * dueño prende un módulo desde el panel y quiere verlo andar sin
 * reiniciar el servidor: media hora esperando es un mensaje de soporte.
 */

const VIGENCIA_MS = 30_000

let prendidos: Set<string> | null = null
let leidoEn = 0

/** Vacía la caché a mano. Útil cuando el panel acaba de tocar un módulo. */
export function forgetModules(): void {
  prendidos = null
}

async function cargar(): Promise<Set<string>> {
  const ahora = Date.now()
  if (prendidos && ahora - leidoEn < VIGENCIA_MS) return prendidos
  try {
    prendidos = new Set(await getEnabledModules())
    leidoEn = ahora
  } catch {
    // Si la base no contesta, seguimos con lo último que sabíamos. Un
    // módulo que se apaga tarde es mejor que un turno que se cae entero
    // por no poder leer una tabla de banderas.
    prendidos ??= new Set()
  }
  return prendidos
}

/** ¿Está prendido este módulo? Una clave que no existe es siempre `false`. */
export async function isModuleEnabled(key: string): Promise<boolean> {
  return (await cargar()).has(key)
}

/** Los módulos prendidos, para armar el prompt o responderle al panel. */
export async function enabledModules(): Promise<string[]> {
  const activos = await cargar()
  // En el orden de `MODULES` y no en el que devuelva la base: así el
  // prompt del bot no cambia de forma entre dos turnos iguales.
  return MODULES.filter((m) => activos.has(m.key)).map((m) => m.key)
}
