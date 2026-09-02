import { useEffect, useState } from 'react'
import { supabase, configured } from '../lib/supabase.js'
import Login from '../pages/Login.jsx'
import Instalar from '../pages/Instalar.jsx'

/**
 * Muro de entrada: sin sesión no hay panel. Escucha los cambios de la
 * sesión, así el login entra y el logout saca sin recargar la página.
 *
 * Antes del login hay una pregunta más: ¿esta instalación ya tiene
 * usuarios? Si no, no hay nadie que pueda entrar — se muestra el
 * asistente de instalación en vez del login.
 */
export default function RequireAuth({ children }) {
  const [session, setSession] = useState(undefined) // undefined = averiguando
  const [instalado, setInstalado] = useState(undefined)

  useEffect(() => {
    fetch('/api/install/status')
      .then((r) => r.json())
      .then((st) => setInstalado(Boolean(st.installed)))
      // Si no se pudo preguntar, mejor mostrar el login que un asistente
      // que tampoco va a poder hacer nada.
      .catch(() => setInstalado(true))
  }, [])

  useEffect(() => {
    if (!configured) {
      setSession(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (instalado === undefined || session === undefined) return null
  if (!instalado) return <Instalar onListo={() => setInstalado(true)} />
  if (!session) return <Login />
  return children
}
