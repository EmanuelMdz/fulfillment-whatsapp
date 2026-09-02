import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { api } from '../lib/api.js'

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
  { key: 'ecommerce', nombre: 'Ecommerce', detalle: 'Clientes, productos, ventas. Para vender cosas.' },
  { key: 'servicios', nombre: 'Servicios', detalle: 'Pacientes, prestaciones, consultas. Para agendar turnos.' },
]

export default function Instalar({ onListo }) {
  const [estado, setEstado] = useState(null) // { dbReady, pending, installed, auto, detail }
  const [sql, setSql] = useState(null) // { sql, token } — solo sin token de acceso
  const [copiado, setCopiado] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [migrando, setMigrando] = useState(false)
  const [form, setForm] = useState({
    pack: 'ecommerce',
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

  return (
    <div className="instalar-wrap">
      <div className="instalar">
        <h1>Instalación</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {onListo
            ? 'Un par de pasos y el panel queda listo. No hace falta abrir una terminal.'
            : 'Cambios pendientes en la base de datos.'}
        </p>

        <div className="pasos">
          <span className={`paso ${paso === 1 ? 'activo' : paso > 1 ? 'hecho' : ''}`}>1. La base</span>
          {onListo && <span className={`paso ${paso === 2 ? 'activo' : paso > 2 ? 'hecho' : ''}`}>2. El negocio y tu usuario</span>}
          {onListo && <span className={`paso ${paso === 3 || listo ? 'activo' : ''}`}>3. Entrar</span>}
        </div>

        {error && <p className="error-text">{error}</p>}
        {estado?.detail && <p className="error-text">{estado.detail}</p>}
        {!estado && <p className="muted">Consultando…</p>}

        {/* ── Paso 1 (con token): la base se prepara sola ─────── */}
        {estado && auto && pendientes > 0 && (
          <div className="card">
            <h2>Preparar la base de datos</h2>
            <p className="muted">
              El servidor tiene el token de acceso de Supabase: crea las tablas solo.
              {migrando ? ' Creando…' : ` Faltan: ${estado.pending.join(', ')}`}
            </p>
            <div className="acciones-inline">
              <button className="btn primary" onClick={migrar} disabled={migrando}>
                <RefreshCw size={15} /> {migrando ? 'Creando las tablas…' : 'Crear las tablas ahora'}
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 1 (sin token): el SQL para pegar ──────────── */}
        {estado && !auto && (pendientes > 0 || (!estado.installed && !listo)) && (
          <div className="card">
            <h2>{pendientes ? 'Preparar la base de datos' : 'Confirmar el acceso a la base'}</h2>
            <p className="muted">
              El servidor no tiene el token de acceso de Supabase, así que las tablas las creás vos
              con un paste. (Si cargás SUPABASE_ACCESS_TOKEN en el hosting, este paso desaparece.)
            </p>
            <ol className="steps">
              <li>Copiá todo el texto de abajo.</li>
              <li>En Supabase: menú <strong>SQL Editor</strong> → New query → pegalo → <strong>Run</strong>.</li>
              <li>Volvé acá y tocá Verificar.</li>
            </ol>
            <textarea className="sql-box" readOnly value={sql?.sql ?? 'Armando el SQL…'} />
            <div className="acciones-inline">
              <button className="btn primary" onClick={copiar} disabled={!sql}>
                {copiado ? <Check size={15} /> : <Copy size={15} />} {copiado ? 'Copiado' : 'Copiar'}
              </button>
              <button className="btn" onClick={verificar} disabled={verificando}>
                <RefreshCw size={15} /> {verificando ? 'Verificando…' : 'Verificar'}
              </button>
              {pendientes > 0 && <span className="muted">Faltan: {estado.pending.join(', ')}</span>}
            </div>
          </div>
        )}

        {/* ── Paso 2: el negocio y el dueño ──────────────────── */}
        {estado && !pendientes && !estado.installed && !listo && (
          <form className="card" onSubmit={terminar}>
            <h2>El negocio</h2>
            <div className="grid-2">
              {PACKS.map((p) => (
                <label className="check" key={p.key} style={{ alignItems: 'flex-start' }}>
                  <input
                    type="radio"
                    name="pack"
                    checked={form.pack === p.key}
                    onChange={() => setForm({ ...form, pack: p.key })}
                  />
                  <span>
                    <strong>{p.nombre}</strong>
                    <br />
                    <span className="muted">{p.detalle}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="field">
              <span>Nombre del negocio (la IA se presenta con esto)</span>
              <input
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                required
              />
            </label>
            <div className="grid-2">
              <label className="field">
                <span>Zona horaria</span>
                <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                  {zonas.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Moneda (lo que se muestra al lado de los precios)</span>
                <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={form.seedDemo}
                onChange={(e) => setForm({ ...form, seedDemo: e.target.checked })}
              />
              <span>Cargar un catálogo de ejemplo, para que el bot tenga de qué hablar hoy (se borra después)</span>
            </label>

            <h2 style={{ marginTop: 18 }}>Tu usuario</h2>
            <p className="muted">Con este entrás al panel. Después podés sumar más gente desde Ajustes.</p>
            <div className="grid-2">
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="field">
                <span>Contraseña (mínimo 8)</span>
                <input
                  type="password"
                  value={form.ownerPassword}
                  onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </div>

            {auto && (
              <label className="field">
                <span>
                  Para confirmar que sos vos: los <strong>últimos 8 caracteres</strong> del token de
                  acceso (SUPABASE_ACCESS_TOKEN) que cargaste en el hosting
                </span>
                <input
                  value={form.tokenTail}
                  onChange={(e) => setForm({ ...form, tokenTail: e.target.value })}
                  autoComplete="off"
                  maxLength={8}
                  required
                  style={{ maxWidth: 200 }}
                />
              </label>
            )}

            <button className="btn primary" type="submit" disabled={trabajando || !puedeTerminar}>
              {trabajando ? 'Instalando…' : 'Terminar la instalación'}
            </button>
            {!auto && !sql?.token && (
              <p className="muted" style={{ marginTop: 8 }}>
                Falta el código de instalación: recargá la página y pegá el SQL de nuevo.
              </p>
            )}
          </form>
        )}

        {/* ── Paso 3: listo ──────────────────────────────────── */}
        {(listo || (estado?.installed && !pendientes)) && (
          <div className="card">
            <h2>{listo ? 'Instalado' : 'Todo al día'}</h2>
            <p className="muted">
              {listo
                ? 'El panel está listo. Lo que sigue: entrá, conectá el número en Conexión y cargá la clave de IA en Studio.'
                : 'La base no tiene cambios pendientes.'}
            </p>
            {onListo && (
              <button className="btn primary" onClick={onListo}>
                <Check size={15} /> Entrar al panel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
