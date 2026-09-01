import { supabase } from './supabase.js'

/**
 * Llamadas a la API del servidor (`/api/panel/*`): las acciones que el
 * navegador no puede hacer solo — mandar WhatsApps, devolver al bot,
 * manejar la sesión del número.
 *
 * Viaja el access_token de la sesión: el servidor lo valida contra
 * Supabase Auth. Ninguna clave compartida llega al navegador.
 */
export async function api(path, body) {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sesión vencida — volvé a entrar')

  const res = await fetch(`/api/panel${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `El servidor respondió ${res.status}`)
  return json
}
