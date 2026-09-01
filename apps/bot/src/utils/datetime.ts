/**
 * La fecha y hora "de ahora" tal como la va a leer el modelo en el prompt.
 *
 * Lleva el DÍA DE LA SEMANA escrito a propósito: con solo "01/08/2026
 * 13:49" el modelo NO deduce que es sábado, y entonces promete cosas para
 * días en los que el negocio no atiende ("te confirmo mañana" dicho un
 * sábado es un domingo). Esto salió de un caso real; no lo saques.
 *
 * La zona horaria viene de la configuración del negocio (app_config), no
 * de este archivo: cada instalación vive en su propio huso.
 */
export function formatNowForPrompt(timezone: string, at: Date = new Date()): string {
  return at.toLocaleString('es-AR', {
    timeZone: timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
