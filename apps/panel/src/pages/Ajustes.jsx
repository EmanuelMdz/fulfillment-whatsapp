import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Save, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'
import { Avatar, Badge, Button, Card, Field, Input, Notice, PageHeader, Select } from '../ui'

const CAMPOS = [
  { key: 'debounce_seconds', label: 'Espera antes de contestar (segundos)', min: 5, max: 600 },
  { key: 'send_pause_min_ms', label: 'Pausa mínima entre envíos (ms)', min: 2000, max: 60000 },
  { key: 'send_pause_max_ms', label: 'Pausa máxima entre envíos (ms)', min: 2000, max: 60000 },
  { key: 'quiet_hours_start', label: 'No enviar seguimientos desde (hora local)', min: 0, max: 23 },
  { key: 'quiet_hours_end', label: 'Retomar seguimientos a las (hora local)', min: 0, max: 23 },
]

export default function Ajustes() {
  const [config, setConfig] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const avisar = useCallback((texto, esError = false) => setAviso({ texto, esError }), [])
  useEffect(() => {
    supabase.from('app_config').select('*').eq('id', 1).maybeSingle()
      .then(({ data, error }) => error ? avisar(error.message, true) : setConfig(data))
  }, [avisar])

  async function guardar() {
    setGuardando(true)
    try {
      await api('/settings', Object.fromEntries(CAMPOS.map(({ key }) => [key, config[key]])))
      avisar('Configuración guardada.')
    } catch (err) { avisar(err.message, true) }
    finally { setGuardando(false) }
  }

  return <>
    <PageHeader title="Ajustes" subtitle="Los tiempos del motor y las personas que pueden entrar al panel." />
    {aviso && <Notice tone={aviso.esError ? 'error' : 'ok'} className="mb-4">{aviso.texto}</Notice>}
    <div className="grid gap-5">
      <Card title="Comportamiento del agente" subtitle="El objetivo, la información, los datos a pedir y las reglas de seguimiento se definen en el prompt.">
        <Button to="/studio">Editar prompt en Studio</Button>
      </Card>
      <Card title="Tiempos del motor" subtitle="La espera reúne mensajes antes de responder. Las pausas regulan la cola. La ventana nocturna posterga seguimientos; usá la misma hora de inicio y fin para desactivarla.">
        {!config ? <p>Cargando…</p> : <>
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS.map(({ key, label, min, max }) => <Field key={key} label={label}>
              <Input type="number" min={min} max={max} value={config[key] ?? min}
                onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} />
            </Field>)}
          </div>
          <Button className="mt-4" icon={Save} variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>}
      </Card>
      <Usuarios avisar={avisar} />
    </div>
  </>
}

function Usuarios({ avisar }) {
  const [usuarios, setUsuarios] = useState([])
  const [yo, setYo] = useState('')
  const [alta, setAlta] = useState({ email: '', password: '', role: 'member' })
  const [canManage, setCanManage] = useState(false)
  const [cambiando, setCambiando] = useState(null) // id del usuario al que se le cambia la contraseña
  const [nuevaClave, setNuevaClave] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await api('/users')
      setUsuarios(r.users ?? [])
      setYo(r.me ?? '')
      setCanManage(Boolean(r.canManage))
    } catch (err) {
      avisar(`No se pudieron listar los usuarios: ${err.message}`, true)
    }
  }, [avisar])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function crear(e) {
    e.preventDefault()
    setTrabajando(true)
    try {
      const r = await api('/users', alta)
      avisar(r.existia ? 'Ese usuario ya existía: ahora es del equipo.' : 'Usuario creado.')
      setAlta({ email: '', password: '', role: 'member' })
      cargar()
    } catch (err) {
      avisar(err.message, true)
    } finally {
      setTrabajando(false)
    }
  }

  async function cambiarClave(id) {
    setTrabajando(true)
    try {
      await api('/users/password', { id, password: nuevaClave })
      avisar('Contraseña cambiada.')
      setCambiando(null)
      setNuevaClave('')
    } catch (err) {
      avisar(err.message, true)
    } finally {
      setTrabajando(false)
    }
  }

  async function borrar(u) {
    if (!window.confirm(`¿Sacar a ${u.email} del panel?`)) return
    try {
      await api('/users/remove', { id: u.id })
      avisar('Usuario borrado.')
      cargar()
    } catch (err) {
      avisar(err.message, true)
    }
  }

  return (
    <Card title="Usuarios" subtitle="Quién puede entrar a este panel. Todos ven todo: es el equipo de un negocio.">
      <ul className="divide-y divide-line">
        {usuarios.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
            <Avatar email={u.email} size={34} />
            <span className="min-w-[180px] flex-1 text-[13.5px]">
              <span className="font-semibold text-ink">{u.email}</span>
              {u.email === yo && <span className="text-ink-3"> (vos)</span>}{' '}
              {u.role === 'owner' && <Badge tone="green">dueño</Badge>}
              {!u.role && <Badge tone="yellow">fuera del equipo</Badge>}
            </span>
            {canManage && (cambiando === u.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="password"
                  className="w-56"
                  placeholder="Nueva contraseña (mínimo 8)"
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  autoComplete="new-password"
                />
                <Button size="sm" variant="primary" onClick={() => cambiarClave(u.id)} disabled={trabajando || nuevaClave.length < 8}>
                  Cambiar
                </Button>
                <Button size="sm" onClick={() => setCambiando(null)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={KeyRound} onClick={() => setCambiando(u.id)}>
                  Contraseña
                </Button>
                {u.email !== yo && (
                  <Button size="sm" variant="danger" icon={Trash2} onClick={() => borrar(u)}>
                    Borrar
                  </Button>
                )}
              </div>
            ))}
          </li>
        ))}
      </ul>

      {!canManage && <Notice className="mt-4">Solo el dueño puede agregar usuarios o cambiar contraseñas.</Notice>}
      {canManage && <form onSubmit={crear} className="mt-4 grid gap-3 border-t border-line pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email de la persona nueva">
            <Input
              type="email"
              value={alta.email}
              onChange={(e) => setAlta({ ...alta, email: e.target.value })}
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Contraseña inicial (mínimo 8)">
            <Input
              type="password"
              value={alta.password}
              onChange={(e) => setAlta({ ...alta, password: e.target.value })}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
        </div>
        <Field label="Permisos">
          <Select value={alta.role} onChange={(e) => setAlta({ ...alta, role: e.target.value })}>
            <option value="member">Miembro: atiende y configura el negocio</option>
            <option value="owner">Dueño: también administra usuarios y actualizaciones</option>
          </Select>
        </Field>
        <div>
          <Button variant="primary" type="submit" icon={UserPlus} disabled={trabajando}>
            {trabajando ? 'Un momento…' : 'Sumar al equipo'}
          </Button>
        </div>
      </form>}
    </Card>
  )
}
