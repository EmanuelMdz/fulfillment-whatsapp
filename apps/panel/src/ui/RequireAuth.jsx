import { useEffect, useState } from 'react'
import { supabase, configured } from '../lib/supabase.js'
import Login from '../pages/Login.jsx'

/**
 * Muro de entrada: sin sesión no hay panel. Escucha los cambios de la
 * sesión, así el login entra y el logout saca sin recargar la página.
 */
export default function RequireAuth({ children }) {
  const [session, setSession] = useState(undefined) // undefined = averiguando

  useEffect(() => {
    if (!configured) {
      setSession(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />
  return children
}
