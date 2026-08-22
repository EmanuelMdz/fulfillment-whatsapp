import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnv } from '../config/env.js'

/**
 * Cliente de Supabase con la clave de servicio: saltea RLS a propósito,
 * porque el servidor actúa en nombre del negocio, no de un usuario.
 *
 * Esta clave NUNCA puede llegar al navegador. El panel usa la clave
 * pública y entra con su propio usuario.
 */

let cached: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (cached) return cached
  const env = loadEnv()
  cached = createClient(env.supabase.url, env.supabase.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
