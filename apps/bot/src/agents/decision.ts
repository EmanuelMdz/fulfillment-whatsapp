import { extractJson } from './parsers.js'

/** Acciones genéricas del motor. El prompt decide cuándo usarlas. */
export interface TurnDecision {
  messages: string[]
  escalateReason: string | null
  data: Record<string, string> | null
}

const MAX_BUBBLES = 3

export function parseTurnDecision(raw: string): TurnDecision {
  const parsed = extractJson(raw) as {
    mensajes?: unknown
    derivar?: unknown
    datos?: unknown
  } | null

  if (!parsed || !Array.isArray(parsed.mensajes)) {
    // Un objeto de control mal formado no debe filtrarse al chat como texto.
    return { messages: parsed ? [] : cleanMessages([raw]), escalateReason: null, data: null }
  }

  const escalateReason = typeof parsed.derivar === 'string' ? parsed.derivar.trim().slice(0, 500) || null : null
  let data: Record<string, string> | null = null
  if (parsed.datos && typeof parsed.datos === 'object' && !Array.isArray(parsed.datos)) {
    const entries = Object.entries(parsed.datos)
      .filter(([k, v]) => k.trim() && !['__proto__', 'constructor', 'prototype'].includes(k.trim()) && typeof v === 'string' && v.trim())
      .map(([k, v]) => [k.trim(), (v as string).trim()])
    if (entries.length) data = Object.fromEntries(entries)
  }

  return { messages: cleanMessages(parsed.mensajes), escalateReason, data }
}

function cleanMessages(messages: unknown[]): string[] {
  return messages
    .filter((m): m is string => typeof m === 'string')
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => m.replace(/\bHttps?:\/\//g, (s) => s.toLowerCase()))
    .slice(0, MAX_BUBBLES)
}
