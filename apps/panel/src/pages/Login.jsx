import { useState } from 'react'
import { LogIn } from 'lucide-react'
import { supabase, configured } from '../lib/supabase.js'
import iso from '../assets/ainnovate-iso.png'
import { Button, Card, Field, Input, Notice, WhatsappIcon } from '../ui'

/**
 * Entrada al panel. Los usuarios los crea el asistente de instalación o
 * Ajustes → Usuarios; acá solo se entra con email y contraseña.
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

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
    <div className="flex min-h-screen items-center justify-center p-5">
      <Card className="w-full max-w-[380px]">
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <img src={iso} alt="" className="h-20 w-20" />
          <div>
            <h1 className="text-[20px] font-bold text-ink">Entrar al panel</h1>
            <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[13px] text-ink-3">
              <WhatsappIcon size={13} className="text-brand" />
              Atención por WhatsApp con IA
            </p>
          </div>
        </div>

        {!configured ? (
          <Notice tone="error">
            El servidor no informó la conexión a Supabase. Revisá que SUPABASE_URL y el token estén
            cargados en el hosting (o en el .env) y recargá.
          </Notice>
        ) : (
          <form onSubmit={entrar} className="grid gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button variant="primary" type="submit" icon={LogIn} disabled={cargando} className="w-full">
              {cargando ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
