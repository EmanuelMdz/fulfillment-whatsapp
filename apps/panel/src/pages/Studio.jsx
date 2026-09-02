import { useEffect, useState } from 'react'
import { FlaskConical, Save } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'
import CampoClave from '../ui/CampoClave.jsx'

/**
 * Studio: lo que la IA es y cómo habla, editable sin tocar código.
 *
 * Acá es donde el bot deja de sonar a robot: los prompts de arranque son
 * genéricos a propósito y el dueño los reescribe con la voz del negocio.
 * También viven acá el modelo de IA con su clave, la llave general, la
 * zona horaria y el grupo de avisos.
 *
 * Lo que el servidor necesita leer al toque (modelo, zona, grupo, llave)
 * se guarda por la API del servidor, que valida y vacía su caché. Los
 * prompts van directo a la base: el bot los lee frescos en cada turno.
 */

const SECCIONES = [
  { key: 'identidad', nombre: 'Identidad — quién es y cómo habla' },
  { key: 'atencion', nombre: 'Atención — qué puede y qué no puede hacer' },
  { key: 'seguimientos', nombre: 'Seguimientos — cómo retoma a los que no contestan' },
  {
    key: 'mensaje_pedido_anotado',
    nombre: 'Mensaje fijo — cuando el cliente confirma un pedido',
    ayuda: 'Se manda tal cual, sin pasar por el modelo, cuando el bot anota un pedido y lo pasa al equipo. No prometas tiempos: la confirmación puede tardar horas.',
  },
  {
    key: 'mensaje_puente',
    nombre: 'Mensaje fijo — cuando el modelo no supo qué decir',
    ayuda: 'Se manda tal cual cuando el modelo devuelve vacío. El chat pasa a revisión para que lo levante una persona.',
  },
]
const ORDEN = SECCIONES.map((s) => s.key)
const indice = (p) => (ORDEN.includes(p.section) ? ORDEN.indexOf(p.section) : 99)

const ZONAS = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return []
  }
})()

const MODELO_SUGERIDO = { gemini: 'gemini-2.5-flash', openai: 'gpt-4.1-mini' }

export default function Studio() {
  const [prompts, setPrompts] = useState([])
  const [config, setConfig] = useState(null)
  const [claves, setClaves] = useState(null)
  const [grupos, setGrupos] = useState(null) // null = sin lista (WhatsApp no conectado)
  const [guardando, setGuardando] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [prueba, setPrueba] = useState(null)

  useEffect(() => {
    supabase
      .from('prompts')
      .select('*')
      .then(({ data }) => setPrompts((data ?? []).slice().sort((a, b) => indice(a) - indice(b))))
    supabase
      .from('app_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setConfig(data))
    api('/secrets').then(setClaves).catch(() => {})
    api('/groups')
      .then((r) => setGrupos(r.groups?.length ? r.groups : null))
      .catch(() => setGrupos(null))
  }, [])

  function avisar(texto, esError = false) {
    setAviso({ texto, esError })
    setTimeout(() => setAviso(null), 3500)
  }

  async function guardarPrompt(p) {
    setGuardando(p.id)
    const { error } = await supabase
      .from('prompts')
      .update({ content: p.content, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    setGuardando(null)
    avisar(error ? `No se pudo guardar: ${error.message}` : 'Prompt guardado.', Boolean(error))
  }

  async function guardarNegocio() {
    setGuardando('config')
    try {
      await api('/settings', {
        business_name: config.business_name ?? '',
        timezone: config.timezone || 'UTC',
        notify_chat_id: config.notify_chat_id || '',
        bot_enabled: config.bot_enabled ?? true,
      })
      avisar('Configuración guardada.')
    } catch (err) {
      avisar(`No se pudo guardar: ${err.message}`, true)
    } finally {
      setGuardando(null)
    }
  }

  async function guardarModelo() {
    setGuardando('modelo')
    try {
      await api('/settings', {
        llm_provider: config.llm_provider || 'gemini',
        llm_model: config.llm_model || MODELO_SUGERIDO[config.llm_provider || 'gemini'],
      })
      avisar('Modelo guardado.')
      setPrueba(null)
    } catch (err) {
      avisar(`No se pudo guardar: ${err.message}`, true)
    } finally {
      setGuardando(null)
    }
  }

  async function guardarClave(key, valor) {
    try {
      const r = await api('/secrets', { [key]: valor })
      setClaves(r.claves)
      avisar(valor ? 'Clave guardada.' : 'Clave borrada.')
      setPrueba(null)
    } catch (err) {
      avisar(err.message, true)
    }
  }

  async function probarModelo() {
    setPrueba({ texto: 'Probando…' })
    try {
      const r = await api('/secrets/test', { que: 'llm' })
      setPrueba(
        r.ok
          ? { ok: true, texto: `El modelo respondió: "${r.respuesta}"` }
          : { ok: false, texto: r.error },
      )
    } catch (err) {
      setPrueba({ ok: false, texto: err.message })
    }
  }

  const proveedor = config?.llm_provider === 'openai' ? 'openai' : 'gemini'
  const claveDelProveedor = proveedor === 'openai' ? 'openai_api_key' : 'gemini_api_key'
  const zonas = config?.timezone && !ZONAS.includes(config.timezone) ? [config.timezone, ...ZONAS] : ZONAS
  const grupoActualEnLista = grupos?.some((g) => g.id === config?.notify_chat_id)

  return (
    <>
      <h1 className="page-title">Studio</h1>
      <p className="page-sub">Los prompts del bot, el modelo de IA y la configuración del negocio.</p>
      {aviso && <p className={aviso.esError ? 'error-text' : 'ok-text'}>{aviso.texto}</p>}

      {config && (
        <div className="card">
          <h2>Negocio</h2>
          <label className="field">
            <span>Nombre del negocio (la IA se presenta con esto)</span>
            <input
              value={config.business_name ?? ''}
              onChange={(e) => setConfig({ ...config, business_name: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Zona horaria (para la ventana nocturna y las fechas que lee la IA)</span>
            {zonas.length ? (
              <select
                value={config.timezone ?? 'UTC'}
                onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
              >
                {zonas.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            ) : (
              <input
                value={config.timezone ?? ''}
                onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                placeholder="America/Montevideo"
              />
            )}
          </label>
          <label className="field">
            <span>
              Grupo de WhatsApp que recibe los avisos
              {grupos ? '' : ' — conectá el número para elegirlo de una lista'}
            </span>
            {grupos ? (
              <select
                value={config.notify_chat_id ?? ''}
                onChange={(e) => setConfig({ ...config, notify_chat_id: e.target.value })}
              >
                <option value="">Ninguno (sin avisos al equipo)</option>
                {!grupoActualEnLista && config.notify_chat_id && (
                  <option value={config.notify_chat_id}>Actual: {config.notify_chat_id}</option>
                )}
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={config.notify_chat_id ?? ''}
                onChange={(e) => setConfig({ ...config, notify_chat_id: e.target.value })}
                placeholder="Sin esto, no hay avisos al equipo"
              />
            )}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={config.bot_enabled ?? true}
              onChange={(e) => setConfig({ ...config, bot_enabled: e.target.checked })}
            />
            <span>
              Bot prendido — apagarlo frena TODAS las respuestas; los mensajes se siguen
              guardando y los turnos esperan.
            </span>
          </label>
          <button className="btn primary" onClick={guardarNegocio} disabled={guardando === 'config'}>
            <Save size={15} /> {guardando === 'config' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {config && (
        <div className="card">
          <h2>Modelo de IA</h2>
          <p className="muted">
            El bot redacta con este modelo. Gemini tiene capa gratuita y alcanza para empezar. Los
            nombres de modelo cambian seguido: si el bot deja de contestar y la prueba da 404, es
            que este nombre ya no existe.
          </p>
          <label className="field">
            <span>Proveedor</span>
            <select
              value={proveedor}
              onChange={(e) =>
                setConfig({
                  ...config,
                  llm_provider: e.target.value,
                  llm_model: MODELO_SUGERIDO[e.target.value],
                })
              }
            >
              <option value="gemini">Gemini (Google)</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="field">
            <span>Modelo — sugerido: {MODELO_SUGERIDO[proveedor]}</span>
            <input
              value={config.llm_model ?? ''}
              onChange={(e) => setConfig({ ...config, llm_model: e.target.value })}
              placeholder={MODELO_SUGERIDO[proveedor]}
            />
          </label>
          <button className="btn primary" onClick={guardarModelo} disabled={guardando === 'modelo'}>
            <Save size={15} /> {guardando === 'modelo' ? 'Guardando…' : 'Guardar modelo'}
          </button>
          <div style={{ height: 12 }} />
          <CampoClave
            etiqueta={proveedor === 'openai' ? 'Clave de OpenAI' : 'Clave de Gemini'}
            ayuda={
              proveedor === 'openai'
                ? 'se crea en platform.openai.com/api-keys'
                : 'se crea gratis en aistudio.google.com/apikey'
            }
            estado={claves?.[claveDelProveedor]}
            onGuardar={(v) => guardarClave(claveDelProveedor, v)}
          />
          <div className="acciones-inline">
            <button className="btn" onClick={probarModelo}>
              <FlaskConical size={15} /> Probar clave y modelo
            </button>
            {prueba && (
              <span className={prueba.ok === true ? 'ok-text' : prueba.ok === false ? 'error-text' : 'muted'}>
                {prueba.texto}
              </span>
            )}
          </div>
        </div>
      )}

      {prompts.map((p, i) => {
        const seccion = SECCIONES.find((s) => s.key === p.section)
        return (
          <div className="card" key={p.id}>
            <h2>
              {seccion?.nombre ?? p.section}
              {p.channel ? ` (canal: ${p.channel})` : ''}
            </h2>
            {seccion?.ayuda && <p className="muted">{seccion.ayuda}</p>}
            <label className="field">
              <textarea
                value={p.content}
                style={seccion?.ayuda ? { minHeight: 60 } : undefined}
                onChange={(e) => {
                  const copia = [...prompts]
                  copia[i] = { ...p, content: e.target.value }
                  setPrompts(copia)
                }}
              />
            </label>
            <button className="btn primary" onClick={() => guardarPrompt(p)} disabled={guardando === p.id}>
              <Save size={15} /> {guardando === p.id ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )
      })}
    </>
  )
}
