import { useEffect, useRef, useState } from 'react'
import { Clock, Eye, EyeOff, Send, Trash2 } from 'lucide-react'
import { api } from '../lib/api.js'

/**
 * Probar el bot sin gastar un número: el mismo contexto, el mismo
 * contrato del turno real — pero acá, y mostrando la DECISIÓN completa.
 *
 * Debajo de cada respuesta se ve lo que en producción es invisible: si
 * hubiera derivado (y por qué), qué datos hubiera guardado en la ficha
 * y qué pedido hubiera armado. Es la mejor forma de afinar los prompts
 * y la ficha del catálogo antes de conectar el número.
 *
 * Dos herramientas más: "Ver lo que lee la IA" muestra el prompt
 * completo tal como lo recibe el modelo (nombre, prompts, fecha, catálogo
 * con ids, motivos), y "¿Qué recordatorio mandaría?" corre el agente de
 * seguimientos sobre esta conversación sin agendar nada.
 */
export default function TestChat() {
  const [mensajes, setMensajes] = useState([]) // {role, content, meta?}
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState(null)
  const [contexto, setContexto] = useState(null) // texto del system prompt
  const [verContexto, setVerContexto] = useState(false)
  const [seguimientos, setSeguimientos] = useState(null)
  const [pensandoSeg, setPensandoSeg] = useState(false)
  const fin = useRef(null)

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length, pensando, seguimientos])

  async function mandar(e) {
    e.preventDefault()
    const contenido = texto.trim()
    if (!contenido || pensando) return
    setError(null)
    setTexto('')
    setSeguimientos(null)

    const historia = [...mensajes, { role: 'user', content: contenido }]
    setMensajes(historia)
    setPensando(true)
    try {
      const r = await api('/test-chat', {
        messages: historia.map(({ role, content }) => ({ role, content })),
      })
      const respuesta = r.decision.messages.map((m) => ({ role: 'assistant', content: m }))
      const meta = {
        derivar: r.decision.escalateReason,
        datos: r.decision.data,
        pedido: r.decision.order,
      }
      if (respuesta.length) respuesta[respuesta.length - 1].meta = meta
      setMensajes([...historia, ...respuesta])
    } catch (err) {
      setError(err.message)
    } finally {
      setPensando(false)
    }
  }

  async function alternarContexto() {
    if (verContexto) {
      setVerContexto(false)
      return
    }
    setVerContexto(true)
    // Se pide cada vez que se abre: el catálogo o un prompt pudieron cambiar.
    try {
      const r = await api('/test-context')
      setContexto(r.system)
    } catch (err) {
      setContexto(`No se pudo armar: ${err.message}`)
    }
  }

  async function probarSeguimientos() {
    if (!mensajes.length || pensandoSeg) return
    setPensandoSeg(true)
    setError(null)
    try {
      const r = await api('/test-followups', {
        messages: mensajes.map(({ role, content }) => ({ role, content })),
      })
      setSeguimientos(r.seguimientos ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setPensandoSeg(false)
    }
  }

  function cuando(iso) {
    return new Date(iso).toLocaleString('es-UY', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <h1 className="page-title">Probar el bot</h1>
      <p className="page-sub">
        Charlá como si fueras un cliente. Nada de esto toca los chats reales ni la base.
      </p>

      <div className="chat" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="chat-thread" style={{ display: 'flex' }}>
          <div className="thread-head">
            <span className="who">Simulador</span>
            <button className="btn small" onClick={alternarContexto} title="El prompt completo, tal como lo recibe el modelo">
              {verContexto ? <EyeOff size={15} /> : <Eye size={15} />} Lo que lee la IA
            </button>
            <button
              className="btn small"
              onClick={probarSeguimientos}
              disabled={!mensajes.length || pensandoSeg}
              title="Corre el agente de seguimientos sobre esta charla, sin agendar nada"
            >
              <Clock size={15} /> {pensandoSeg ? 'Pensando…' : '¿Qué recordatorio mandaría?'}
            </button>
            <button
              className="btn small"
              onClick={() => {
                setMensajes([])
                setSeguimientos(null)
                setError(null)
              }}
            >
              <Trash2 size={15} /> Empezar de nuevo
            </button>
          </div>
          {verContexto && (
            <pre className="contexto">{contexto ?? 'Armando…'}</pre>
          )}
          <div className="thread-body">
            {mensajes.length === 0 && (
              <p className="muted">Escribí el primer mensaje, como lo escribiría un cliente.</p>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={`bubble ${m.role === 'user' ? 'in' : 'out'}`}>
                {m.content}
                {m.meta && (m.meta.derivar || m.meta.datos || m.meta.pedido) && (
                  <span className="meta">
                    {m.meta.derivar ? `derivaría: ${m.meta.derivar} · ` : ''}
                    {m.meta.datos ? `ficha: ${Object.keys(m.meta.datos).join(', ')} · ` : ''}
                    {m.meta.pedido ? `pedido: ${m.meta.pedido.items.length} item(s)` : ''}
                  </span>
                )}
              </div>
            ))}
            {pensando && <div className="bubble out pendiente">pensando…</div>}
            {seguimientos && (
              <ul className="seguimientos-prueba">
                {seguimientos.length === 0 && <li className="muted">No mandaría ningún recordatorio.</li>}
                {seguimientos.map((s, i) => (
                  <li key={i}>
                    <strong>En {s.en_horas} h</strong> ({cuando(s.cuando)}){s.fallback ? ' · horas inventadas por el modelo, se usó el fallback' : ''}
                    <br />
                    {s.mensaje}
                  </li>
                ))}
              </ul>
            )}
            <div ref={fin} />
          </div>
          {error && <p className="error-text" style={{ margin: '4px 12px' }}>{error}</p>}
          <form className="composer" onSubmit={mandar}>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Mensaje del cliente de prueba…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  mandar(e)
                }
              }}
            />
            <button className="btn primary" type="submit" disabled={pensando || !texto.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
