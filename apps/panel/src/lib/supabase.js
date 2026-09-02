import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase del PANEL: clave pública + sesión del usuario.
 * Las policies de la base ("equipo") son las que deciden qué puede ver.
 * La clave de servicio no existe acá — vive solo en el servidor.
 *
 * La URL y la clave pública las sirve el servidor en /config.js
 * (window.__FW__), en tiempo de ejecución: no se hornean en el build.
 * Así un mismo build anda en cualquier instalación y el alumno nunca
 * tiene que "recompilar" por una variable.
 */

const cfg = (typeof window !== 'undefined' && window.__FW__) || {}
const url = cfg.supabaseUrl
const anonKey = cfg.supabaseAnonKey

/** false si el servidor no informó la conexión — la pantalla de login lo explica. */
export const configured = Boolean(url && anonKey)

export const supabase = configured ? createClient(url, anonKey) : null
