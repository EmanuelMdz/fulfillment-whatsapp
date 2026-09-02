import { useState } from 'react'
import { supabase, configured } from '../lib/supabase.js'

/**
 * Entrada al panel. El usuario se crea en Supabase (el instalador crea
 * el primero); acá solo se entra con email y contraseña.
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  if (!configured) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <h1>Panel</h1>
          <p className="error-text">
            El servidor no informó la conexión a Supabase. Revisá que SUPABASE_URL y
            SUPABASE_ANON_KEY estén cargadas en el hosting (o en el .env) y recargá.
          </p>
        </div>
      </div>
    )
  }

  async function entrar(e) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)
    if (error) setError('No se pudo entrar: revisá el email y la contraseña.')
    // Si salió bien, RequireAuth se entera solo por onAuthStateChange.
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={entrar}>
        <h1>Panel</h1>
        <p className="muted" style={{ marginTop: 0 }}>Entrá con tu usuario del negocio.</p>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary" type="submit" disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
