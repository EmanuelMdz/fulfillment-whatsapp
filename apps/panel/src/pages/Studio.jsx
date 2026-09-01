import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

/**
 * Studio: lo que la IA es y cómo habla, editable sin tocar código.
 *
 * Acá es donde el bot deja de sonar a robot: los prompts de arranque son
 * genéricos a propósito y el dueño los reescribe con la voz del negocio.
 * También viven acá la llave general y el grupo de avisos.
 */

const NOMBRES_SECCION = {
  identidad: 'Identidad — quién es y cómo habla',
  atencion: 'Atención — qué puede y qué no puede hacer',
  seguimientos: 'Seguimientos — cómo retoma a los que no contestan',
}

export default function Studio() {
  const [prompts, setPrompts] = useState([])
  const [config, setConfig] = useState(null)
  const [guardando, setGuardando] = useState(null) // id del prompt o 'config'
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    supabase
      .from('prompts')
      .select('*')
      .order('section')
      .then(({ data }) => setPrompts(data ?? []))
    supabase
      .from('app_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setConfig(data))
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

  async function guardarConfig() {
    setGuardando('config')
    const { error } = await supabase
      .from('app_config')
      .update({
        business_name: config.business_name,
        timezone: config.timezone,
        notify_chat_id: config.notify_chat_id || null,
        bot_enabled: config.bot_enabled,
      })
      .eq('id', 1)
    setGuardando(null)
    avisar(error ? `No se pudo guardar: ${error.message}` : 'Configuración guardada.', Boolean(error))
  }

  return (
    <>
      <h1 className="page-title">Studio</h1>
      <p className="page-sub">Los prompts del bot y la configuración del negocio.</p>
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
            <span>Zona horaria (para la ventana nocturna y las fechas)</span>
            <input
              value={config.timezone ?? ''}
              onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
              placeholder="America/Montevideo"
            />
          </label>
          <label className="field">
            <span>Grupo o número que recibe los avisos (id del chat, ej. 1203…@g.us)</span>
            <input
              value={config.notify_chat_id ?? ''}
              onChange={(e) => setConfig({ ...config, notify_chat_id: e.target.value })}
              placeholder="Sin esto, no hay avisos al equipo"
            />
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
          <button className="btn primary" onClick={guardarConfig} disabled={guardando === 'config'}>
            <Save size={15} /> {guardando === 'config' ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {prompts.map((p, i) => (
        <div className="card" key={p.id}>
          <h2>
            {NOMBRES_SECCION[p.section] ?? p.section}
            {p.channel ? ` (canal: ${p.channel})` : ''}
          </h2>
          <label className="field">
            <textarea
              value={p.content}
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
      ))}
    </>
  )
}
