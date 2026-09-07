import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { api } from '../lib/api.js'
import iso from '../assets/ainnovate-iso.png'
import { Button, Card, Checkbox, Field, Input, Notice, Radio, Select, Textarea } from '../ui'

/**
 * El asistente de instalación. Sin terminal.
 *
 * Con el token de acceso de Supabase cargado en el hosting (lo normal),
 * las tablas se crearon solas al arrancar el servidor y acá quedan dos
 * pasos: el negocio y el usuario. La prueba de que quien instala es el
 * dueño son los últimos caracteres de ese token, que él mismo cargó.
 *
 * Sin token, aparece un paso más: copiar un SQL y pegarlo en el editor
 * de Supabase. Ese SQL trae un código de instalación al azar que queda
 * guardado en la base; el último paso lo manda de vuelta. Así nadie que
 * encuentre la URL antes que el dueño puede quedarse con el panel.
 *
 * `onListo` lo pasa RequireAuth cuando se usa antes del login. Desde el
 * menú (ya instalado) no viene, y la pantalla solo aplica las
 * actualizaciones de la base.
 */

const ZONAS = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC']
  }
})()

function zonaDelNavegador() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const PACKS = [
  { key: 'general', nombre: 'General', detalle: 'Clientes, productos, pedidos. Sirve para cualquier negocio; después se renombra todo desde Ajustes.' },
  { key: 'ecommerce', nombre: 'Ecommerce', detalle: 'Clientes, productos, ventas. Para vender cosas.' },
  { key: 'servicios', nombre: 'Servicios', detalle: 'Pacientes, prestaciones, consultas. Registra solicitudes; el equipo confirma fecha y disponibilidad.' },
]

function Paso({ n, texto, estado }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-pill px-3 py-1 text-[12.5px] font-semibold',
        estado === 'activo' && 'bg-brand-soft text-brand-2',
        estado === 'hecho' && 'bg-brand text-white',
        !estado && 'bg-surface-2 text-ink-3',
      )}
    >
      {estado === 'hecho' ? <Check size={12} /> : <span>{n}.</span>}
      {texto}
    </span>
  )
}

export default function Instalar({ onListo }) {
  const [estado, setEstado] = useState(null) // { dbReady, pending, installed, auto, detail }
  const [sql, setSql] = useState(null) // { sql, token } — solo sin token de acceso
  const [copiado, setCopiado] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [migrando, setMigrando] = useState(false)
  const [form, setForm] = useState({
    pack: 'general',
    businessName: '',
    timezone: zonaDelNavegador(),
    currency: '$',
    seedDemo: true,
    ownerEmail: '',
    ownerPassword: '',
    tokenTail: '',
  })
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [listo, setListo] = useState(false)
  const migracionAutomaticaIntentada = useRef(false)

  const consultar = useCallback(async () => {
    const r = await fetch('/api/install/status')
    const st = await r.json()
    setEstado(st)
    return st
  }, [])

  const pedirSql = useCallback(async () => {
    const r = await fetch('/api/install/sql')
    setSql(await r.json())
  }, [])

  // Con token: aplica lo pendiente. Antes del login va por la ruta pública
  // del asistente; ya adentro, por la del panel (con sesión).
  const migrar = useCallback(async () => {
    setMigrando(true)
    setError(null)
    try {
      if (onListo) {
        const r = await fetch('/api/install/migrate', { method: 'POST' })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || `El servidor respondió ${r.status}`)
      } else {
        await api('/migrate', {})
      }
      await consultar()
    } catch (err) {
      setError(`No se pudieron crear las tablas: ${err.message}`)
    } finally {
      setMigrando(false)
    }
  }, [consultar, onListo])

  useEffect(() => {
    consultar()
      .then((st) => {
        if (st.auto) {
          // El servidor ya lo intentó al arrancar; si quedó algo (por
          // ejemplo, la base tardó en despertarse), se reintenta una vez.
          if (st.pending?.length && !migracionAutomaticaIntentada.current) {
            migracionAutomaticaIntentada.current = true
            migrar()
          }
        } else if (st.pending?.length || !st.installed) {
          pedirSql()
        }
      })
      .catch(() => setError('No se pudo hablar con el servidor.'))
  }, [consultar, pedirSql, migrar])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(sql.sql)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setError('No se pudo copiar solo: seleccioná el texto y copialo a mano.')
    }
  }

  async function verificar() {
    setError(null)
    setVerificando(true)
    try {
      const st = await consultar()
      if (st.pending?.length) {
        setError('Todavía faltan migraciones. ¿Le diste a Run en el editor de Supabase? Puede tardar unos segundos en verse.')
      } else if (st.installed && onListo) {
        onListo()
      }
    } finally {
      setVerificando(false)
    }
  }

  async function terminar(e) {
    e.preventDefault()
    setTrabajando(true)
    setError(null)
    try {
      const r = await fetch('/api/install/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, token: sql?.token ?? '' }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `El servidor respondió ${r.status}`)
      setListo(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(false)
    }
  }

  const auto = Boolean(estado?.auto)
  const pendientes = estado?.pending?.length ?? 0
  const paso = !estado ? 0 : pendientes ? 1 : !estado.installed ? 2 : 3
  const zonas = ZONAS.includes(form.timezone) ? ZONAS : [form.timezone, ...ZONAS]
  // Sin token hace falta el código del SQL para terminar; con token, no.
  const puedeTerminar = auto ? form.tokenTail.trim().length >= 8 : Boolean(sql?.token)
  const pasoEstado = (n) => (paso === n || (n === 3 && listo) ? 'activo' : paso > n ? 'hecho' : undefined)

  return (
    <div className={clsx('mx-auto w-full max-w-[760px]', onListo && 'min-h-screen px-4 py-8 md:py-12')}>
      <div className="mb-6 flex items-center gap-3">
        <img src={iso} alt="" className="h-14 w-14" />
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Instalación</h1>
          <p className="text-[13.5px] text-ink-2">
            {onListo
              ? 'Un par de pasos y el panel queda listo. No hace falta abrir una terminal.'
              : 'Cambios pendientes en la base de datos.'}
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Paso n={1} texto="La base" estado={pasoEstado(1)} />
        {onListo && <Paso n={2} texto="El negocio y tu usuario" estado={pasoEstado(2)} />}
        {onListo && <Paso n={3} texto="Entrar" estado={pasoEstado(3)} />}
      </div>

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}
      {estado?.detail && (
        <Notice tone="error" className="mb-4">
          {estado.detail}
        </Notice>
      )}
      {!estado && <p className="text-[13.5px] text-ink-3">Consultando…</p>}

      <div className="grid gap-5">
        {/* ── Paso 1 (con token): la base se prepara sola ─────── */}
        {estado && auto && pendientes > 0 && (
          <Card title="Preparar la base de datos" subtitle="El servidor tiene el token de acceso de Supabase: crea las tablas solo.">
            <p className="mb-4 text-[13px] text-ink-2">
              {migrando ? 'Creando…' : `Faltan: ${estado.pending.join(', ')}`}
            </p>
            <Button variant="primary" icon={RefreshCw} onClick={migrar} disabled={migrando}>
              {migrando ? 'Creando las tablas…' : 'Crear las tablas ahora'}
            </Button>
          </Card>
        )}

        {/* ── Paso 1 (sin token): el SQL para pegar ──────────── */}
        {estado && !auto && (pendientes > 0 || (!estado.installed && !listo)) && (
          <Card
            title={pendientes ? 'Preparar la base de datos' : 'Confirmar el acceso a la base'}
            subtitle="El servidor no tiene el token de acceso de Supabase, así que las tablas las creás vos con un paste. Si cargás SUPABASE_ACCESS_TOKEN en el hosting, este paso desaparece."
          >
            <ol className="mb-4 grid list-decimal gap-1.5 pl-5 text-[13.5px] text-ink-2">
              <li>Copiá todo el texto de abajo.</li>
              <li>
                En Supabase: menú <strong>SQL Editor</strong> → New query → pegalo → <strong>Run</strong>.
              </li>
              <li>Volvé acá y tocá Verificar.</li>
            </ol>
            <Textarea className="min-h-56 font-mono text-[12px]" readOnly value={sql?.sql ?? 'Armando el SQL…'} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" icon={copiado ? Check : Copy} onClick={copiar} disabled={!sql}>
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
              <Button icon={RefreshCw} onClick={verificar} disabled={verificando}>
                {verificando ? 'Verificando…' : 'Verificar'}
              </Button>
              {pendientes > 0 && <span className="text-[12.5px] text-ink-3">Faltan: {estado.pending.join(', ')}</span>}
            </div>
          </Card>
        )}

        {/* ── Paso 2: el negocio y el dueño ──────────────────── */}
        {estado && !pendientes && !estado.installed && !listo && (
          <form onSubmit={terminar} className="grid gap-5">
            <Card title="El negocio">
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {PACKS.map((p) => (
                    <label
                      key={p.key}
                      className={clsx(
                        'flex cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 transition-colors',
                        form.pack === p.key ? 'border-brand bg-brand-soft/40' : 'border-line hover:bg-surface-2',
                      )}
                    >
                      <input
                        type="radio"
                        name="pack"
                        className="mt-[3px] h-4 w-4 accent-brand"
                        checked={form.pack === p.key}
                        onChange={() => setForm({ ...form, pack: p.key })}
                      />
                      <span>
                        <span className="block text-[14px] font-semibold text-ink">{p.nombre}</span>
                        <span className="block text-[12.5px] text-ink-3">{p.detalle}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Field label="Nombre del negocio (la IA se presenta con esto)">
                  <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Zona horaria">
                    <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                      {zonas.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Moneda (lo que se muestra al lado de los precios)">
                    <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                  </Field>
                </div>
                <Checkbox
                  label="Cargar un catálogo de ejemplo, para que el bot tenga de qué hablar hoy (se borra después)"
                  checked={form.seedDemo}
                  onChange={(e) => setForm({ ...form, seedDemo: e.target.checked })}
                />
              </div>
            </Card>

            <Card title="Tu usuario" subtitle="Con este entrás al panel. Después podés sumar más gente desde Ajustes.">
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email">
                    <Input
                      type="email"
                      value={form.ownerEmail}
                      onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                      autoComplete="username"
                      required
                    />
                  </Field>
                  <Field label="Contraseña (mínimo 8)">
                    <Input
                      type="password"
                      value={form.ownerPassword}
                      onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </Field>
                </div>
                {auto && (
                  <Field
                    label="Para confirmar que sos vos: los últimos 8 caracteres del token de acceso (SUPABASE_ACCESS_TOKEN) que cargaste en el hosting"
                    className="sm:max-w-xs"
                  >
                    <Input
                      value={form.tokenTail}
                      onChange={(e) => setForm({ ...form, tokenTail: e.target.value })}
                      autoComplete="off"
                      maxLength={8}
                      required
                    />
                  </Field>
                )}
                <div>
                  <Button variant="primary" type="submit" disabled={trabajando || !puedeTerminar}>
                    {trabajando ? 'Instalando…' : 'Terminar la instalación'}
                  </Button>
                </div>
                {!auto && !sql?.token && (
                  <p className="text-[12.5px] text-ink-3">
                    Falta el código de instalación: recargá la página y pegá el SQL de nuevo.
                  </p>
                )}
              </div>
            </Card>
          </form>
        )}

        {/* ── Paso 3: listo ──────────────────────────────────── */}
        {(listo || (estado?.installed && !pendientes)) && (
          <Card title={listo ? 'Instalado' : 'Todo al día'}>
            <p className="text-[13.5px] text-ink-2">
              {listo
                ? 'El panel está listo. Lo que sigue: entrá, conectá el número en Conexión y cargá la clave de IA en Studio.'
                : 'La base no tiene cambios pendientes.'}
            </p>
            {onListo && (
              <div className="mt-4">
                <Button variant="primary" icon={Check} onClick={onListo}>
                  Entrar al panel
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
