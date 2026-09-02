/**
 * La API de administración de Supabase (api.supabase.com), con el token
 * de acceso de la cuenta (`sbp_…`).
 *
 * Con este token el servidor administra el proyecto entero: busca las
 * claves, corre SQL (crear tablas), cambia la configuración de Auth. Es
 * lo que permite que el alumno cargue DOS variables y nada más, y que el
 * mismo token le sirva después a su Claude para seguir mejorando el
 * sistema.
 *
 * Todo lo de acá recibe el token y el proyecto por parámetro a propósito:
 * `env.ts` lo usa antes de que exista la configuración, para buscar las
 * claves. Los atajos con la configuración ya cargada están en db/migrate.ts.
 */

const API = 'https://api.supabase.com/v1'

async function mgmt<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const texto = await res.text()
  if (!res.ok) {
    const pista =
      res.status === 401
        ? ' (¿el token de acceso es válido? Se crea en Supabase → Account → Access Tokens)'
        : res.status === 404
          ? ' (¿la URL del proyecto es la correcta?)'
          : ''
    throw new Error(`Supabase ${method} ${path} respondió ${res.status}${pista}: ${texto.slice(0, 300)}`)
  }
  return (texto ? JSON.parse(texto) : {}) as T
}

/**
 * Las dos claves del proyecto: la pública (va al navegador) y la de
 * servicio (solo el servidor). Son las mismas que aparecen en
 * Settings → API; el alumno ya no tiene que copiarlas.
 */
export async function fetchProjectKeys(ref: string, token: string): Promise<{ anon: string; serviceRole: string }> {
  const keys = await mgmt<Array<{ name?: string; api_key?: string }>>(
    token,
    'GET',
    `/projects/${ref}/api-keys?reveal=true`,
  )
  const anon = keys.find((k) => k.name === 'anon')?.api_key
  const serviceRole = keys.find((k) => k.name === 'service_role')?.api_key
  if (!anon || !serviceRole) {
    throw new Error(
      `Supabase no devolvió las claves anon y service_role del proyecto ${ref} (vinieron: ${keys.map((k) => k.name).join(', ') || 'ninguna'})`,
    )
  }
  return { anon, serviceRole }
}

/** Corre SQL en el proyecto, como el editor SQL de Supabase. Sirve para crear tablas. */
export async function runSql(ref: string, token: string, query: string): Promise<unknown> {
  return mgmt(token, 'POST', `/projects/${ref}/database/query`, { query })
}

/**
 * Apaga los registros abiertos de Auth. Los usuarios del panel los crea
 * el servidor; con esto prendido, cualquiera podría crearse uno (aunque
 * no vería nada: ver 0008_equipo.sql). Es el paso manual que antes
 * había que hacer en Authentication → Sign In / Providers.
 */
export async function disableSignups(ref: string, token: string): Promise<void> {
  await mgmt(token, 'PATCH', `/projects/${ref}/config/auth`, { disable_signup: true })
}
