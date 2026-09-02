import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'

/**
 * El asistente de instalación. Tres pasos, sin terminal:
 *
 *   1. Pegar un SQL en Supabase (crea las tablas). El servidor sabe qué
 *      falta leyendo la tabla _migrations, así que el mismo paso sirve
 *      después para las actualizaciones.
 *   2. El negocio: pack, nombre, zona horaria, moneda, catálogo de ejemplo.
 *   3. El usuario dueño.
 *
 * El SQL trae un código de instalación al azar que queda guardado en la
 * base; el paso 3 lo manda de vuelta. Así el servidor sabe que quien
 * termina la instalación es quien tiene acceso a esa base — y no alguien
 * que encontró la URL antes que el dueño.
 *
 * `onListo` lo pasa RequireAuth cuando se usa antes del login. Desde el
 * menú (ya instalado) no viene, y la pantalla solo muestra el paso 1.
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
  { key: 'ecommerce', nombre: 'Ecommerce', detalle: 'Clientes, productos, ventas. Inventario y cobros prendidos.' },
  { key: 'servicios', nombre: 'Servicios', detalle: 'Pacientes, prestaciones, consultas. Horarios y equipo prendidos.' },
]

export default function Instalar({ onListo }) {
  const [estado, setEstado] = useState(null) // { dbReady, pending, installed, detail }
  const [sql, setSql] = useState(null) // { sql, token }
  const [copiado, setCopiado] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [form, setForm] = useState({
    pack: 'ecommerce',
    businessName: '',
    timezone: zonaDelNavegador(),
    currency: '$',
    seedDemo: true,
    ownerEmail: '',
    ownerPassword: '',
  })
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [listo, setListo] = useState(false)

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

  useEffect(() => {
    consultar()
      .then((st) => {
        if (st.pending?.length || !st.installed) pedirSql()
      })
      .catch(() => setError('No se pudo hablar con el servidor.'))
  }, [consultar, pedirSql])

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

  const pendientes = estado?.pending?.length ?? 0
  const paso = !estado ? 0 : pendientes ? 1 : !estado.installed ? 2 : 3
  const zonas = ZONAS.includes(form.timezone) ? ZONAS : [form.timezone, ...ZONAS]

  return (
    <div className="instalar-wrap">
      <div className="instalar">
        <h1>Instalación</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {onListo
            ? 'Tres pasos y el panel queda listo. No hace falta abrir una terminal.'
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

        {/* ── Paso 1: el SQL ─────────────────────────────────── */}
        {estado && (pendientes > 0 || (!estado.installed && !listo)) && (
          <div className="card">
            <h2>{pendientes ? 'Preparar la base de datos' : 'Confirmar el acceso a la base'}</h2>
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
              {pendientes > 0 && (
                <span className="muted">
                  Faltan: {estado.pending.join(', ')}
                </span>
              )}
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
            <button className="btn primary" type="submit" disabled={trabajando || !sql?.token}>
              {trabajando ? 'Instalando…' : 'Terminar la instalación'}
            </button>
            {!sql?.token && (
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
