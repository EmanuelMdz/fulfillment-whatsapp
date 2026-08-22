/**
 * Convierte cualquier cosa que se pueda haber tirado en una línea legible.
 *
 * Los errores de Supabase no son instancias de Error: son objetos con
 * message, details, hint y code. Sin esto, un `console.error` los imprime
 * enteros y el registro queda ilegible justo cuando más lo necesitás.
 */
export function describe(error: unknown): string {
  if (error instanceof Error) return error.message

  if (error && typeof error === 'object') {
    const e = error as { message?: string; hint?: string; code?: string; details?: string }
    const partes = [
      e.message,
      e.code ? `[${e.code}]` : '',
      e.hint || e.details,
    ].filter(Boolean)
    if (partes.length) return partes.join(' ').replace(/\s+/g, ' ').slice(0, 300)
  }

  return String(error)
}
