import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase del PANEL: clave pública + sesión del usuario.
 * Las policies de la base ("equipo") son las que deciden qué puede ver.
 * La clave de servicio no existe acá — vive solo en el servidor.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** false si faltan las variables VITE_ — la pantalla de login lo explica. */
export const configured = Boolean(url && anonKey)

export const supabase = configured ? createClient(url, anonKey) : null
