/**
 * Sacarle el JSON a la respuesta de un modelo.
 *
 * Los modelos NO devuelven JSON limpio de forma confiable, por más que el
 * prompt lo exija: lo envuelven en ```json, le ponen una frase antes
 * ("Acá está la respuesta:"), o le pegan texto después. Parsear con
 * JSON.parse directo funciona el 90% de las veces — y el otro 10% son
 * clientes sin respuesta.
 *
 * La estrategia: intentar directo, después sacar el bloque de código si
 * lo hay, y por último quedarse con lo que va de la primera "{" a la
 * última "}". Si nada funciona, null — y el que llama decide qué hacer
 * con el texto crudo (que suele ser una respuesta usable en sí misma).
 */
export function extractJson(raw: string): unknown | null {
  const text = raw.trim()
  if (!text) return null

  // 1) Tal cual vino.
  try {
    return JSON.parse(text)
  } catch {
    // sigue abajo
  }

  // 2) Adentro de un bloque ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      // sigue abajo
    }
  }

  // 3) De la primera llave a la última.
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // se rindió
    }
  }

  return null
}
