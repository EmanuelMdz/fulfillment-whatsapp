import { useEffect, useState } from 'react'
import { Eye, EyeOff, FlaskConical, Save } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'
import { Button, CampoClave, Card, Checkbox, Field, Input, Notice, PageHeader, Select, Textarea } from '../ui'

/**
 * Studio: lo que la IA es y cómo habla, editable sin tocar código.
 *
 * El prompt es UNO: un texto en markdown que el dueño escribe con sus
 * secciones (quién sos, datos del negocio, reglas, cuándo derivar, cómo
 * cerrar, seguimientos). Es exactamente lo que el modelo recibe como
 * texto de sistema, más lo mecánico que el código agrega abajo: la
 * fecha, el catálogo, los motivos y el formato de respuesta. "Ver cómo
 * lo lee la IA" muestra el resultado completo.
 *
 * También viven acá el modelo de IA con su clave, la llave general, la
 * zona horaria y el grupo de avisos. Lo que el servidor necesita leer al
 * toque se guarda por su API, que valida y vacía su caché. El prompt va
 * directo a la base: el bot lo lee fresco en cada turno.
 */

const ZONAS = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return []
  }
})()

const MODELO_SUGERIDO = { gemini: 'gemini-2.5-flash', openai: 'gpt-4.1-mini' }

const SECCIONES_SUGERIDAS = ['## Quién sos', '## Datos del negocio', '## Reglas', '## Cuándo derivar', '## Cómo cerrar', '## Seguimientos']

export default function Studio() {
  const [prompt, setPrompt] = useState(null) // la fila 'sistema' de la tabla prompts
  const [config, setConfig] = useState(null)
  const [claves, setClaves] = useState(null)
  const [grupos, setGrupos] = useState(null) // null = sin lista (WhatsApp no conectado)
  const [guardando, setGuardando] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [prueba, setPrueba] = useState(null)
  const [contexto, setContexto] = useState(null)
  const [vista, setVista] = useState(null) // null | 'turno' | 'seguimientos'

  useEffect(() => {
    supabase
      .from('prompts')
      .select('*')
      .eq('section', 'sistema')
      .is('channel', null)
      .maybeSingle()
      .then(({ data }) => setPrompt(data ?? { faltante: true }))
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

  async function guardarPrompt() {
    setGuardando('prompt')
    const { error } = await supabase
      .from('prompts')
      .update({ content: prompt.content, updated_at: new Date().toISOString() })
      .eq('id', prompt.id)
    setGuardando(null)
    avisar(error ? `No se pudo guardar: ${error.message}` : 'Prompt guardado. El bot lo usa desde el próximo mensaje.', Boolean(error))
    if (!error && vista) cargarContexto(vista)
  }

  // Los dos textos de sistema completos, tal cual los reciben los
  // modelos: el del turno (contestar) y el del agente de recordatorios.
  async function cargarContexto(cual) {
    setContexto(null)
    try {
      const r = await api(cual === 'seguimientos' ? '/test-context?agente=seguimientos' : '/test-context')
      setContexto(r.system)
    } catch (err) {
      setContexto(`No se pudo armar: ${err.message}`)
    }
  }

  function alternarVista(cual) {
    if (vista === cual) {
      setVista(null)
      return
    }
    setVista(cual)
    cargarContexto(cual)
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
  const tonoPrueba = prueba?.ok === true ? 'text-brand-2' : prueba?.ok === false ? 'text-danger' : 'text-ink-3'

  return (
    <>
      <PageHeader title="Studio" subtitle="El prompt del bot, el modelo de IA y la configuración del negocio." />
      {aviso && (
        <Notice tone={aviso.esError ? 'error' : 'ok'} className="mb-4">
          {aviso.texto}
        </Notice>
      )}

      {/* ── El prompt ─────────────────────────────────────────── */}
      {prompt && (
        <Card
          title="El prompt del bot"
          subtitle="Un solo texto, en markdown: lo que la IA recibe como texto de sistema. Lo escribe tu Claude; acá lo ves y lo retocás si querés."
          actions={
            <>
              <Button size="sm" icon={vista === 'turno' ? EyeOff : Eye} onClick={() => alternarVista('turno')}>
                Cómo lo lee la IA
              </Button>
              <Button size="sm" icon={vista === 'seguimientos' ? EyeOff : Eye} onClick={() => alternarVista('seguimientos')}>
                El agente de recordatorios
              </Button>
            </>
          }
        >
          {prompt.faltante ? (
            <Notice tone="warn">
              No hay prompt todavía: hay cambios pendientes en la base. Aplicalos desde la franja de arriba y recargá.
            </Notice>
          ) : (
            <div className="grid gap-4">
              <Notice tone="info">
                Pedile a tu Claude: <em>"escribime el prompt de mi cliente"</em>. Te pregunta lo que falta, lo escribe en{' '}
                <code>prompts/negocio.md</code> y lo sube con <code>npm run prompt:push</code>. Acá aparece solo.
              </Notice>
              <p className="text-[13px] text-ink-2">
                Secciones que en Ainnovate recomendamos, en este orden:{' '}
                {SECCIONES_SUGERIDAS.map((s, i) => (
                  <span key={s}>
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] text-ink">{s}</code>
                    {i < SECCIONES_SUGERIDAS.length - 1 ? ' ' : ''}
                  </span>
                ))}
                . Lo que se vende NO va acá: va en el catálogo. El sistema agrega abajo la fecha, el catálogo, los
                motivos y el formato de respuesta; los dos botones de arriba muestran el resultado completo.
              </p>
              <div className={vista ? 'grid gap-4 xl:grid-cols-2' : ''}>
                <Textarea
                  className="min-h-[520px] font-mono text-[13px] leading-[1.55]"
                  value={prompt.content}
                  onChange={(e) => setPrompt({ ...prompt, content: e.target.value })}
                  spellCheck={false}
                />
                {vista && (
                  <div className="grid content-start gap-2">
                    <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">
                      {vista === 'turno'
                        ? 'Lo que lee la IA al contestar: tu prompt más lo que agrega el sistema'
                        : 'Lo que lee el agente de recordatorios: el mismo prompt, otra tarea'}
                    </p>
                    <pre className="max-h-[520px] overflow-auto rounded-xl bg-side p-4 text-[12px] leading-[1.55] whitespace-pre-wrap text-side-ink">
                      {contexto ?? 'Armando…'}
                    </pre>
                  </div>
                )}
              </div>
              <div>
                <Button variant="primary" icon={Save} onClick={guardarPrompt} disabled={guardando === 'prompt'}>
                  {guardando === 'prompt' ? 'Guardando…' : 'Guardar prompt'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {config && (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Card title="Negocio" subtitle="Cómo se presenta el bot y a quién avisa">
            <div className="grid gap-4">
              <Field label="Nombre del negocio (la IA se presenta con esto)">
                <Input
                  value={config.business_name ?? ''}
                  onChange={(e) => setConfig({ ...config, business_name: e.target.value })}
                />
              </Field>
              <Field label="Zona horaria (para la ventana nocturna y las fechas que lee la IA)">
                {zonas.length ? (
                  <Select value={config.timezone ?? 'UTC'} onChange={(e) => setConfig({ ...config, timezone: e.target.value })}>
                    {zonas.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={config.timezone ?? ''}
                    onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                    placeholder="America/Montevideo"
                  />
                )}
              </Field>
              <Field
                label="Grupo de WhatsApp que recibe los avisos"
                hint={grupos ? undefined : 'Conectá el número para elegirlo de una lista.'}
              >
                {grupos ? (
                  <Select
                    value={config.notify_chat_id ?? ''}
                    onChange={(e) => setConfig({ ...config, notify_chat_id: e.target.value })}
                  >
                    <option value="">Ninguno (sin avisos al equipo)</option>
                    {!grupoActualEnLista && config.notify_chat_id && (
                      <option value={config.notify_chat_id}>Actual: {config.notify_chat_id}</option>
                    )}
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={config.notify_chat_id ?? ''}
                    onChange={(e) => setConfig({ ...config, notify_chat_id: e.target.value })}
                    placeholder="Sin esto, no hay avisos al equipo"
                  />
                )}
              </Field>
              <Checkbox
                label="Bot prendido — apagarlo frena TODAS las respuestas; los mensajes se siguen guardando y los turnos esperan."
                checked={config.bot_enabled ?? true}
                onChange={(e) => setConfig({ ...config, bot_enabled: e.target.checked })}
              />
              <div>
                <Button variant="primary" icon={Save} onClick={guardarNegocio} disabled={guardando === 'config'}>
                  {guardando === 'config' ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title="Modelo de IA"
            subtitle="Con qué modelo redacta el bot. Gemini tiene capa gratuita y alcanza para empezar."
          >
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Proveedor">
                  <Select
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
                  </Select>
                </Field>
                <Field label="Modelo" hint={`Sugerido: ${MODELO_SUGERIDO[proveedor]}. Si la prueba da 404, el nombre ya no existe.`}>
                  <Input
                    value={config.llm_model ?? ''}
                    onChange={(e) => setConfig({ ...config, llm_model: e.target.value })}
                    placeholder={MODELO_SUGERIDO[proveedor]}
                  />
                </Field>
              </div>
              <div>
                <Button variant="primary" icon={Save} onClick={guardarModelo} disabled={guardando === 'modelo'}>
                  {guardando === 'modelo' ? 'Guardando…' : 'Guardar modelo'}
                </Button>
              </div>
              <CampoClave
                etiqueta={proveedor === 'openai' ? 'Clave de OpenAI' : 'Clave de Gemini'}
                ayuda={
                  proveedor === 'openai'
                    ? 'Se crea en platform.openai.com/api-keys'
                    : 'Se crea gratis en aistudio.google.com/apikey'
                }
                estado={claves?.[claveDelProveedor]}
                onGuardar={(v) => guardarClave(claveDelProveedor, v)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button icon={FlaskConical} onClick={probarModelo}>
                  Probar clave y modelo
                </Button>
                {prueba && <span className={`text-[13px] ${tonoPrueba}`}>{prueba.texto}</span>}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
