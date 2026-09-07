import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { MODULES } from '@fw/core'
import { ChevronDown, ChevronUp, KeyRound, Plus, Save, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'
import { Avatar, Badge, Button, Card, Field, Input, Notice, PageHeader, Select } from '../ui'

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

  const avisar = useCallback((texto, esError = false) => {
    setAviso({ texto, esError })
    setTimeout(() => setAviso(null), 4000)
  }, [])

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
    avisar(error ? `No se pudo guardar: ${error.message}` : 'Diccionario guardado.', Boolean(error))
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

  if (!config) return <p className="text-[13.5px] text-ink-3">Cargando…</p>

  const estados = config.order_stages ?? []
  const motivos = config.escalation_reasons ?? []
  const labels = config.labels ?? {}
  const prendido = (key) => Boolean(modulos.find((m) => m.key === key)?.enabled)

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Los módulos que corren, las palabras del negocio, los tiempos del bot y quién entra." />
      {aviso && (
        <Notice tone={aviso.esError ? 'error' : 'ok'} className="mb-4">
          {aviso.texto}
        </Notice>
      )}

      <div className="grid gap-5">
        {/* ── Módulos ─────────────────────────────────────────── */}
        <Card
          title="Módulos"
          subtitle='Un módulo apagado no corre, no aparece en el menú y no pide claves. Prenderlo y apagarlo es seguro. Los que dicen "próximamente" todavía no tienen código.'
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {MODULES.map((m) => (
              <label
                key={m.key}
                className={clsx(
                  'flex items-start gap-3 rounded-xl border border-line px-4 py-3 transition-colors',
                  m.available ? 'cursor-pointer hover:bg-surface-2' : 'opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-[3px] h-4 w-4 shrink-0 accent-brand"
                  checked={m.available && prendido(m.key)}
                  disabled={!m.available}
                  onChange={(e) => alternarModulo(m.key, e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-ink">
                    {m.label} {!m.available && <Badge>próximamente</Badge>}
                  </span>
                  <span className="block text-[12.5px] text-ink-3">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          {/* ── Diccionario ─────────────────────────────────────── */}
          <Card
            title="Diccionario"
            subtitle="Cómo se llama cada cosa en este negocio. El panel entero usa estas palabras: en una clínica no hay ventas, hay consultas."
          >
            <div className="grid gap-3">
              {CAMPOS_DICCIONARIO.map((campo) => (
                <Field key={campo.key} label={`${campo.label} — ej. ${campo.ejemplo}`}>
                  <Input
                    value={labels[campo.key] ?? ''}
                    onChange={(e) => editarConfig('labels', { ...labels, [campo.key]: e.target.value })}
                  />
                </Field>
              ))}
              <div>
                <Button variant="primary" icon={Save} onClick={guardarDiccionario} disabled={guardando === 'labels'}>
                  {guardando === 'labels' ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
          </Card>

          {/* ── Avanzado ────────────────────────────────────────── */}
          <Card title="Avanzado" subtitle="Los tiempos del bot. Los valores de fábrica salieron de producción: cambialos sabiendo por qué.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Espera antes de contestar (segundos)"
                hint="Junta los mensajes sueltos del cliente; bajarla hace que el bot conteste tres veces seguidas."
              >
                <Input
                  type="number"
                  min={5}
                  max={600}
                  value={config.debounce_seconds ?? 90}
                  onChange={(e) => editarConfig('debounce_seconds', Number(e.target.value))}
                />
              </Field>
              <Field label="Moneda" hint="Lo que se muestra al lado de los precios.">
                <Input value={config.currency ?? '$'} onChange={(e) => editarConfig('currency', e.target.value)} />
              </Field>
              <Field label="Pausa mínima entre envíos (ms)" hint="Es lo que protege al número: no bajar de 2000.">
                <Input
                  type="number"
                  min={1000}
                  max={60000}
                  step={500}
                  value={config.send_pause_min_ms ?? 2000}
                  onChange={(e) => editarConfig('send_pause_min_ms', Number(e.target.value))}
                />
              </Field>
              <Field label="Pausa máxima entre envíos (ms)">
                <Input
                  type="number"
                  min={1000}
                  max={60000}
                  step={500}
                  value={config.send_pause_max_ms ?? 6000}
                  onChange={(e) => editarConfig('send_pause_max_ms', Number(e.target.value))}
                />
              </Field>
              <Field label="Ventana nocturna: desde (hora local)" hint="A partir de esta hora no salen seguimientos.">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={config.quiet_hours_start ?? 23}
                  onChange={(e) => editarConfig('quiet_hours_start', Number(e.target.value))}
                />
              </Field>
              <Field label="Ventana nocturna: hasta">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={config.quiet_hours_end ?? 9}
                  onChange={(e) => editarConfig('quiet_hours_end', Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Button variant="primary" icon={Save} onClick={guardarAvanzado} disabled={guardando === 'avanzado'}>
                {guardando === 'avanzado' ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
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
        </div>

        {/* ── Usuarios ────────────────────────────────────────── */}
        <Usuarios avisar={avisar} />
      </div>
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
function ListaEditable({ titulo, ayuda, valores, conFinal = false, guardando, onCambio, onGuardar, onAntesDeBorrar }) {
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
    <Card title={titulo} subtitle={ayuda}>
      <ul className="divide-y divide-line">
        {valores.map((v, i) => (
          <li key={v.key} className="flex flex-wrap items-center gap-2 py-2.5">
            <Input
              className="min-w-[160px] flex-1"
              value={v.label}
              onChange={(e) => {
                const copia = [...valores]
                copia[i] = { ...v, label: e.target.value }
                onCambio(copia)
              }}
            />
            <code
              className="rounded-md bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-ink-3"
              title="La clave guardada en la base. No se edita."
            >
              {v.key}
            </code>
            {conFinal && (
              <label
                className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-ink-2"
                title="Un estado final saca al pedido de la bandeja"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={Boolean(v.final)}
                  onChange={(e) => {
                    const copia = [...valores]
                    copia[i] = { ...v, final: e.target.checked }
                    onCambio(copia)
                  }}
                />
                Final
              </label>
            )}
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" icon={ChevronUp} onClick={() => mover(i, -1)} disabled={i === 0} title="Subir" />
              <Button
                size="icon"
                variant="ghost"
                icon={ChevronDown}
                onClick={() => mover(i, 1)}
                disabled={i === valores.length - 1}
                title="Bajar"
              />
              <Button size="icon" variant="ghost" icon={Trash2} className="text-danger" onClick={() => borrar(i)} title="Borrar" />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          className="min-w-[160px] flex-1"
          value={nuevo}
          placeholder="Agregar uno nuevo"
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <Button icon={Plus} onClick={agregar}>
          Agregar
        </Button>
      </div>

      <div className="mt-4">
        <Button variant="primary" icon={Save} onClick={() => onGuardar(valores)} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Card>
  )
}

/**
 * Quién entra al panel. Las altas y bajas pasan por el servidor porque
 * tocan Supabase Auth (clave de servicio) y la tabla del equipo a la vez.
 */
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
