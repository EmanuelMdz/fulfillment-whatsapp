import type { AppConfig } from '../db/queries.js'

/**
 * El modo prueba: mientras está prendido, el bot SOLO le contesta a los
 * números de la lista.
 *
 * Es para el rato más delicado de una instalación: el número del negocio
 * ya está vinculado, pero el prompt todavía no está afinado. Si en ese
 * momento escribe un cliente real, sin esto el bot le contesta cualquier
 * cosa. Con esto, el mensaje se guarda y se ve en el panel, pero el bot
 * se queda callado.
 *
 * El corte está en dos lugares: el webhook (no agenda el turno) y el
 * trabajador de seguimientos (no manda un recordatorio viejo a alguien
 * que ya no está autorizado). Responder a mano desde el panel sigue
 * funcionando siempre: si una persona decide escribir, es su decisión.
 */

/** Se quedan solo los dígitos: "+598 99 123 456" → "59899123456". */
function soloDigitos(valor: string): string {
  return valor.replace(/\D+/g, '')
}

/**
 * Cuántos dígitos del final se comparan.
 *
 * ¿Por qué los ÚLTIMOS dígitos y no el número entero? Porque el mismo
 * teléfono se escribe de varias formas y ninguna es "la correcta":
 *
 *   WhatsApp lo identifica como   59899123456@c.us
 *   el dueño lo escribe como      099 123 456
 *   o como                        +598 99 123 456
 *
 * Ese 0 del principio es el prefijo nacional, y desaparece en cuanto se
 * antepone el código de país. En Argentina pasa lo mismo con el 15 de
 * los celulares (011 15 3333-4444 → +54 9 11 3333 4444). Comparar el
 * final saltea todo eso sin pedirle a nadie que aprenda un formato.
 *
 * Ocho dígitos es un teléfono sin código de país en casi toda la región:
 * suficiente para que dos personas distintas no coincidan, y corto como
 * para que ningún prefijo lo arruine.
 */
const DIGITOS_A_COMPARAR = 8

/** ¿Este chat es uno de los números de prueba? */
export function isTestNumber(chatId: string, numeros: string[]): boolean {
  // Los grupos (@g.us) tienen un id que no es un teléfono; que no
  // coincida con nada es lo correcto.
  if (!/^\d+@c\.us$/.test(chatId)) return false
  const delChat = soloDigitos(chatId.split('@')[0] ?? chatId)
  if (delChat.length < DIGITOS_A_COMPARAR) return false
  const finalDelChat = delChat.slice(-DIGITOS_A_COMPARAR)

  return numeros.some((crudo) => {
    const autorizado = soloDigitos(crudo)
    if (autorizado.length < DIGITOS_A_COMPARAR) return false
    return autorizado.slice(-DIGITOS_A_COMPARAR) === finalDelChat
  })
}

/**
 * ¿El bot puede contestarle a este chat? Con el modo prueba apagado,
 * siempre. Con el modo prendido, solo a los números de la lista.
 */
export function botPuedeResponder(config: AppConfig, chatId: string): boolean {
  if (chatId.startsWith('demo:')) return false
  if (!config.test_mode) return true
  const numeros = Array.isArray(config.test_numbers) ? config.test_numbers : []
  // Modo prueba prendido y sin números cargados: el bot no le contesta a
  // nadie. Es lo correcto — es literalmente lo que se pidió — y el panel
  // avisa que falta cargar un número.
  return isTestNumber(chatId, numeros)
}
