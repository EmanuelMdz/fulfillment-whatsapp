/**
 * Reintentar una operación que puede fallar por causas pasajeras.
 *
 * Las llamadas a servicios externos (el modelo, el puente de WhatsApp)
 * fallan de a ratos: un 503 de sobrecarga, un corte de red de dos
 * segundos. Sin esto, cada falla pasajera es un cliente sin respuesta.
 *
 * La espera crece con cada intento (1s, 2s, 4s) para no golpear a un
 * servicio que ya está saturado. Un 429 —"me estás pidiendo demasiado"—
 * espera el triple: insistir rápido a quien te pidió que pares solo
 * alarga el castigo.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; baseDelayMs?: number; label?: string },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 3
  const baseDelay = opts?.baseDelayMs ?? 1000
  const label = opts?.label ?? 'operación'

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === maxRetries) break

      const isRateLimit = lastError.message.includes('429')
      const delay = baseDelay * Math.pow(2, attempt) * (isRateLimit ? 3 : 1)

      console.warn(
        `[retry] ${label}: intento ${attempt + 1}/${maxRetries} falló (${lastError.message.slice(0, 150)}). Reintento en ${delay}ms`,
      )
      await sleep(delay)
    }
  }

  throw lastError
}
