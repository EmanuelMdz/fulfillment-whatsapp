import { useCallback, useEffect, useState } from 'react'
import { MODULES } from '@fw/core'
import { Save, Plus, Trash2, ChevronUp, ChevronDown, KeyRound, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'

/**
 * Ajustes: lo que hace que el mismo repo se sienta nativo en una tienda
 * y en una clínica, sin tocar código.
 *
 * Cuatro cosas viven acá:
 *
 * 1. Los MÓDULOS. Se prenden y se apagan; nunca se borra una carpeta.
 *    El menú de la izquierda y los pasos del servidor leen esta tabla.
 *
 * 2. Las TRES LISTAS. El diccionario de palabras, los estados por los
 *    que pasa un pedido y los motivos por los que la IA deriva a una
 *    persona. Son datos en `app_config`, no enums en el código.
 *
 * 3. Lo AVANZADO: tiempos del bot, ventana nocturna, moneda. Antes eran
 *    variables de entorno; ahora se guardan por el servidor, que valida.
 *
 * 4. Los USUARIOS del panel. Quien no está acá no entra, aunque tenga
 *    cuenta en Supabase.
 *
 * La regla dura de las listas: **la clave no se edita, la etiqueta
 * sí**. Un pedido guardado dice `stage = 'pago'` y una derivación dice
 * `reason = 'queja'`; si acá se le cambia la clave, esas filas quedan
 * apuntando a un estado que ya no existe y desaparecen de las vistas.
 * Renombrar "Pago" a "Señado" es cambiar la etiqueta y no toca ni una
 * fila vieja.
 */

/** El diccionario: claves fijas del producto, texto libre del negocio. */
const CAMPOS_DICCIONARIO = [
  { key: 'contact', label: 'Contacto, en singular', ejemplo: 'Cliente / Paciente' },
  { key: 'contact_plural', label: 'Contactos, en plural', ejemplo: 'Clientes / Pacientes' },
  { key: 'item', label: 'Lo que se ofrece, en singular', ejemplo: 'Producto / Prestación' },
  { key: 'item_plural', label: 'Lo que se ofrece, en plural', ejemplo: 'Productos / Prestaciones' },
  { key: 'order', label: 'Pedido, en singular', ejemplo: 'Venta / Consulta' },
  { key: 'order_plural', label: 'Pedidos, en plural', ejemplo: 'Ventas / Consultas' },
  { key: 'order_new', label: 'Botón de alta', ejemplo: 'Nueva venta / Nueva consulta' },
]

/** De "Presupuesto enviado" a "presupuesto_enviado": la clave que guarda la base. */
function claveDesde(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

const CAMPOS_AVANZADO = ['debounce_seconds', 'send_pause_min_ms', 'send_pause_max_ms', 'quiet_hours_start', 'quiet_hours_end', 'currency']

export default function Ajustes() {
  const [config, setConfig] = useState(null)
  const [modulos, setModulos] = useState([])
  const [guardando, setGuardando] = useState(null)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    supabase
      .from('app_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setConfig(data))
    supabase
      .from('modules')
      .select('key, enabled')
      .then(({ data }) => setModulos(data ?? []))
  }, [])

  function avisar(texto, esError = false) {
    setAviso({ texto, esError })
    setTimeout(() => setAviso(null), 4000)
  }

  // ── Módulos ────────────────────────────────────────────────
  // Se guarda al toque, sin botón: es un interruptor, y un interruptor
  // que hay que confirmar se siente roto.
  async function alternarModulo(key, enabled) {
    setModulos((previos) =>
      previos.some((m) => m.key === key)
        ? previos.map((m) => (m.key === key ? { ...m, enabled } : m))
        : [...previos, { key, enabled }],
    )
    const { error } = await supabase
      .from('modules')
      .upsert({ key, enabled, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) {
      avisar(`No se pudo guardar el módulo: ${error.message}`, true)
      return
    }
    // El menú se arma con esta tabla: se le avisa para que se rearme.
    window.dispatchEvent(new Event('fw:modules'))
    avisar(enabled ? 'Módulo prendido.' : 'Módulo apagado.')
  }

  // ── Las tres listas ────────────────────────────────────────
  function editarConfig(campo, valor) {
    setConfig((previo) => ({ ...previo, [campo]: valor }))
  }

  async function guardarDiccionario() {
    setGuardando('labels')
    const { error } = await supabase
      .from('app_config')
      .update({ labels: config.labels ?? {} })
      .eq('id', 1)
    setGuardando(null)
    avisar(
      error ? `No se pudo guardar: ${error.message}` : 'Diccionario guardado.',
      Boolean(error),
    )
  }

  async function guardarLista(campo, valores, nombre) {
    if (!valores.length) {
      avisar(`Tiene que quedar al menos un elemento en ${nombre}.`, true)
      return
    }
    if (valores.some((v) => !v.label.trim())) {
      avisar('Hay un elemento sin nombre.', true)
      return
    }
    setGuardando(campo)
    const { error } = await supabase.from('app_config').update({ [campo]: valores }).eq('id', 1)
    setGuardando(null)
    avisar(error ? `No se pudo guardar: ${error.message}` : `${nombre} guardados.`, Boolean(error))
  }

  /** Un estado con pedidos adentro no se borra: quedarían huérfanos. */
  async function puedeBorrarEstado(key) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('stage', key)
    if (count) {
      avisar(`No se puede borrar: hay ${count} pedido(s) en ese estado.`, true)
      return false
    }
    return true
  }

  // ── Avanzado ───────────────────────────────────────────────
  async function guardarAvanzado() {
    setGuardando('avanzado')
    try {
      const patch = {}
      for (const k of CAMPOS_AVANZADO) patch[k] = config[k]
      await api('/settings', patch)
      avisar('Guardado. El bot lo usa desde el próximo mensaje.')
    } catch (err) {
      avisar(err.message, true)
    } finally {
      setGuardando(null)
    }
  }

  if (!config) return <p className="muted">Cargando…</p>

  const estados = config.order_stages ?? []
  const motivos = config.escalation_reasons ?? []
  const labels = config.labels ?? {}
  const prendido = (key) => Boolean(modulos.find((m) => m.key === key)?.enabled)

  return (
    <>
      <h1 className="page-title">Ajustes</h1>
      <p className="page-sub">Los módulos que corren, las palabras del negocio, los tiempos del bot y quién entra.</p>
      {aviso && <p className={aviso.esError ? 'error-text' : 'ok-text'}>{aviso.texto}</p>}

      {/* ── Módulos ─────────────────────────────────────────── */}
      <div className="card">
        <h2>Módulos</h2>
        <p className="muted">
          Un módulo apagado no corre, no aparece en el menú y no pide claves. Prenderlo y
          apagarlo es seguro: no se pierde nada de lo que ya está cargado.
        </p>
        <div className="modulos">
          {MODULES.map((m) => (
            <label className={`modulo ${m.available ? '' : 'off'}`} key={m.key}>
              <input
                type="checkbox"
                checked={m.available && prendido(m.key)}
                disabled={!m.available}
                onChange={(e) => alternarModulo(m.key, e.target.checked)}
              />
              <span className="modulo-nombre">
                {m.label} {!m.available && <span className="chip">próximamente</span>}
              </span>
              <span className="modulo-detalle">{m.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Diccionario ─────────────────────────────────────── */}
      <div className="card">
        <h2>Diccionario</h2>
        <p className="muted">
          Cómo se llama cada cosa en este negocio. El panel entero usa estas palabras: en una
          clínica no hay ventas, hay consultas.
        </p>
        {CAMPOS_DICCIONARIO.map((campo) => (
          <label className="field" key={campo.key}>
            <span>
              {campo.label} — ej. {campo.ejemplo}
            </span>
            <input
              value={labels[campo.key] ?? ''}
              onChange={(e) => editarConfig('labels', { ...labels, [campo.key]: e.target.value })}
            />
          </label>
        ))}
        <button className="btn primary" onClick={guardarDiccionario} disabled={guardando === 'labels'}>
          <Save size={15} /> {guardando === 'labels' ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/* ── Estados del pedido ──────────────────────────────── */}
      <ListaEditable
        titulo={`Estados de ${labels.order_plural?.toLowerCase() ?? 'los pedidos'}`}
        ayuda="El camino que recorre un pedido. El primero es donde nace cuando lo anota el bot; los finales son los que lo sacan de la bandeja."
        valores={estados}
        conFinal
        guardando={guardando === 'order_stages'}
        onAntesDeBorrar={puedeBorrarEstado}
        onCambio={(v) => editarConfig('order_stages', v)}
        onGuardar={(v) => guardarLista('order_stages', v, 'Estados')}
      />

      {/* ── Motivos de derivación ───────────────────────────── */}
      <ListaEditable
        titulo="Motivos de derivación"
        ayuda="Por qué la IA le pasa un chat a una persona. Estos son los que el bot puede elegir: si no está en la lista, no lo puede usar."
        valores={motivos}
        guardando={guardando === 'escalation_reasons'}
        onCambio={(v) => editarConfig('escalation_reasons', v)}
        onGuardar={(v) => guardarLista('escalation_reasons', v, 'Motivos')}
      />

      {/* ── Avanzado ────────────────────────────────────────── */}
      <div className="card">
        <h2>Avanzado</h2>
        <p className="muted">
          Los tiempos del bot. Los valores de fábrica salieron de producción: cambialos sabiendo
          por qué.
        </p>
        <div className="grid-2">
          <label className="field">
            <span>Espera antes de contestar, en segundos. Junta los mensajes sueltos del cliente; bajarla hace que el bot conteste tres veces seguidas.</span>
            <input
              type="number"
              min={5}
              max={600}
              value={config.debounce_seconds ?? 90}
              onChange={(e) => editarConfig('debounce_seconds', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Moneda: lo que se muestra al lado de los precios</span>
            <input
              value={config.currency ?? '$'}
              onChange={(e) => editarConfig('currency', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Pausa mínima entre envíos, en milisegundos. Es lo que protege al número: no bajar de 2000.</span>
            <input
              type="number"
              min={1000}
              max={60000}
              step={500}
              value={config.send_pause_min_ms ?? 2000}
              onChange={(e) => editarConfig('send_pause_min_ms', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Pausa máxima entre envíos, en milisegundos</span>
            <input
              type="number"
              min={1000}
              max={60000}
              step={500}
              value={config.send_pause_max_ms ?? 6000}
              onChange={(e) => editarConfig('send_pause_max_ms', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Ventana nocturna: desde qué hora no salen seguimientos (hora local)</span>
            <input
              type="number"
              min={0}
              max={23}
              value={config.quiet_hours_start ?? 23}
              onChange={(e) => editarConfig('quiet_hours_start', Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Ventana nocturna: hasta qué hora</span>
            <input
              type="number"
              min={0}
              max={23}
              value={config.quiet_hours_end ?? 9}
              onChange={(e) => editarConfig('quiet_hours_end', Number(e.target.value))}
            />
          </label>
        </div>
        <button className="btn primary" onClick={guardarAvanzado} disabled={guardando === 'avanzado'}>
          <Save size={15} /> {guardando === 'avanzado' ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {/* ── Usuarios ────────────────────────────────────────── */}
      <Usuarios avisar={avisar} />
    </>
  )
}

/**
 * Una lista ordenada de {key, label} (más `final` en los estados).
 *
 * El orden importa: en los estados es el camino del pedido, y el primero
 * de la lista es donde nace. Por eso hay flechas y no un ordenamiento
 * alfabético.
 */
function ListaEditable({
  titulo,
  ayuda,
  valores,
  conFinal = false,
  guardando,
  onCambio,
  onGuardar,
  onAntesDeBorrar,
}) {
  const [nuevo, setNuevo] = useState('')

  function agregar() {
    const label = nuevo.trim()
    if (!label) return
    const key = claveDesde(label)
    if (!key) return
    if (valores.some((v) => v.key === key)) return
    onCambio([...valores, conFinal ? { key, label, final: false } : { key, label }])
    setNuevo('')
  }

  function mover(i, delta) {
    const destino = i + delta
    if (destino < 0 || destino >= valores.length) return
    const copia = [...valores]
    ;[copia[i], copia[destino]] = [copia[destino], copia[i]]
    onCambio(copia)
  }

  async function borrar(i) {
    if (onAntesDeBorrar && !(await onAntesDeBorrar(valores[i].key))) return
    onCambio(valores.filter((_, j) => j !== i))
  }

  return (
    <div className="card">
      <h2>{titulo}</h2>
      <p className="muted">{ayuda}</p>

      <ul className="lista-editable">
        {valores.map((v, i) => (
          <li key={v.key}>
            <input
              className="lista-label"
              value={v.label}
              onChange={(e) => {
                const copia = [...valores]
                copia[i] = { ...v, label: e.target.value }
                onCambio(copia)
              }}
            />
            <code className="lista-clave" title="La clave guardada en la base. No se edita.">
              {v.key}
            </code>
            {conFinal && (
              <label className="lista-final" title="Un estado final saca al pedido de la bandeja">
                <input
                  type="checkbox"
                  checked={Boolean(v.final)}
                  onChange={(e) => {
                    const copia = [...valores]
                    copia[i] = { ...v, final: e.target.checked }
                    onCambio(copia)
                  }}
                />
                <span>Final</span>
              </label>
            )}
            <div className="lista-acciones">
              <button className="btn small" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir">
                <ChevronUp size={14} />
              </button>
              <button
                className="btn small"
                onClick={() => mover(i, 1)}
                disabled={i === valores.length - 1}
                title="Bajar"
              >
                <ChevronDown size={14} />
              </button>
              <button className="btn small danger" onClick={() => borrar(i)} title="Borrar">
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="lista-alta">
        <input
          value={nuevo}
          placeholder="Agregar uno nuevo"
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <button className="btn" onClick={agregar}>
          <Plus size={15} /> Agregar
        </button>
      </div>

      <button className="btn primary" onClick={() => onGuardar(valores)} disabled={guardando}>
        <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}

/**
 * Quién entra al panel. Las altas y bajas pasan por el servidor porque
 * tocan Supabase Auth (clave de servicio) y la tabla del equipo a la vez.
 */
function Usuarios({ avisar }) {
  const [usuarios, setUsuarios] = useState([])
  const [yo, setYo] = useState('')
  const [alta, setAlta] = useState({ email: '', password: '' })
  const [cambiando, setCambiando] = useState(null) // id del usuario al que se le cambia la contraseña
  const [nuevaClave, setNuevaClave] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await api('/users')
      setUsuarios(r.users ?? [])
      setYo(r.me ?? '')
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
      setAlta({ email: '', password: '' })
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
    <div className="card">
      <h2>Usuarios</h2>
      <p className="muted">
        Quién puede entrar a este panel. Todos ven todo: es el equipo de un negocio.
      </p>
      <ul className="usuarios" style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
        {usuarios.map((u) => (
          <li key={u.id}>
            <span className="email">
              {u.email}
              {u.email === yo ? ' (vos)' : ''}{' '}
              {u.role === 'owner' && <span className="chip bot">dueño</span>}
              {!u.role && <span className="chip review">fuera del equipo</span>}
            </span>
            {cambiando === u.id ? (
              <>
                <input
                  type="password"
                  placeholder="Nueva contraseña (mínimo 8)"
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  autoComplete="new-password"
                />
                <button className="btn small primary" onClick={() => cambiarClave(u.id)} disabled={trabajando || nuevaClave.length < 8}>
                  Cambiar
                </button>
                <button className="btn small" onClick={() => setCambiando(null)}>Cancelar</button>
              </>
            ) : (
              <>
                <button className="btn small" onClick={() => setCambiando(u.id)}>
                  <KeyRound size={14} /> Contraseña
                </button>
                {u.email !== yo && (
                  <button className="btn small danger" onClick={() => borrar(u)}>
                    <Trash2 size={14} /> Borrar
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={crear}>
        <div className="grid-2">
          <label className="field">
            <span>Email de la persona nueva</span>
            <input
              type="email"
              value={alta.email}
              onChange={(e) => setAlta({ ...alta, email: e.target.value })}
              autoComplete="off"
              required
            />
          </label>
          <label className="field">
            <span>Contraseña inicial (mínimo 8; después la cambia)</span>
            <input
              type="password"
              value={alta.password}
              onChange={(e) => setAlta({ ...alta, password: e.target.value })}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        </div>
        <button className="btn primary" type="submit" disabled={trabajando}>
          <UserPlus size={15} /> {trabajando ? 'Un momento…' : 'Sumar al equipo'}
        </button>
      </form>
    </div>
  )
}
