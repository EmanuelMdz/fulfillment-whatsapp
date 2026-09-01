import { extractJson } from './parsers.js'
import { logEvent } from '../observability/events.js'

/**
 * Lo que el modelo decide en un turno. No es solo la respuesta: también
 * si la conversación necesita una persona y qué datos nuevos dio el
 * cliente para la ficha.
 */
export interface TurnDecision {
  /** Las burbujas a mandar, en orden. */
  messages: string[]
  /** Clave del motivo de derivación, o null si el bot sigue solo. */
  escalateReason: string | null
  /** Datos personales nuevos que dio el cliente (nombre, dirección…). */
  data: Record<string, string> | null
}

const MAX_BUBBLES = 3

/**
 * Convierte la respuesta cruda del modelo en una decisión usable.
 *
 * Es deliberadamente indestructible: si el JSON no aparece, el texto
 * crudo ES la respuesta (los modelos que ignoran el formato suelen
 * contestar bien igual — tirar eso a la basura deja al cliente mudo).
 *
 * `validReasons` son las claves de derivación configuradas para este
 * negocio. Un motivo inventado por el modelo se descarta con aviso: mejor
 * que el bot siga a que derive por un motivo que el panel no conoce.
 */
export function parseTurnDecision(raw: string, validReasons: string[]): TurnDecision {
  const parsed = extractJson(raw) as {
    mensajes?: unknown
    derivar?: unknown
    datos?: unknown
  } | null

  if (!parsed || !Array.isArray(parsed.mensajes)) {
    return { messages: cleanMessages([raw]), escalateReason: null, data: null }
  }

  let escalateReason: string | null = null
  if (typeof parsed.derivar === 'string' && parsed.derivar.trim()) {
    const clave = parsed.derivar.trim()
    if (validReasons.includes(clave)) {
      escalateReason = clave
    } else {
      logEvent({
        eventType: 'internal.error',
        severity: 'warn',
        payload: { donde: 'decision', problema: 'motivo de derivación desconocido', clave },
      })
    }
  }

  let data: Record<string, string> | null = null
  if (parsed.datos && typeof parsed.datos === 'object' && !Array.isArray(parsed.datos)) {
    const limpio: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed.datos as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) limpio[k.trim()] = v.trim()
    }
    if (Object.keys(limpio).length) data = limpio
  }

  return {
    messages: cleanMessages(parsed.mensajes.map((m) => (typeof m === 'string' ? m : ''))),
    escalateReason,
    data,
  }
}

function cleanMessages(messages: string[]): string[] {
  return (
    messages
      .map((m) => m.trim())
      .filter(Boolean)
      // El prompt pide mayúscula inicial y el modelo a veces capitaliza
      // "Https://" — y el chat no reconoce ESO como link clickeable.
      .map((m) => m.replace(/\bHttps?:\/\//g, (s) => s.toLowerCase()))
      // Más de 3 burbujas por turno se siente (y se detecta) como spam.
      .slice(0, MAX_BUBBLES)
  )
}
