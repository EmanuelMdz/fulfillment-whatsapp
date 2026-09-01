import { useEffect, useRef, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { api } from '../lib/api.js'

/**
 * Probar el bot sin gastar un número: el mismo contexto, el mismo
 * contrato del turno real — pero acá, y mostrando la DECISIÓN completa.
 *
 * Debajo de cada respuesta se ve lo que en producción es invisible: si
 * hubiera derivado (y por qué), qué datos hubiera guardado en la ficha
 * y qué pedido hubiera armado. Es la mejor forma de afinar los prompts
 * y la ficha del catálogo antes de conectar el número.
 */
export default function TestChat() {
  const [mensajes, setMensajes] = useState([]) // {role, content, meta?}
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState(null)
  const fin = useRef(null)

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length, pensando])

  async function mandar(e) {
    e.preventDefault()
    const contenido = texto.trim()
    if (!contenido || pensando) return
    setError(null)
    setTexto('')

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
            <button
              className="btn small"
              onClick={() => {
                setMensajes([])
                setError(null)
              }}
            >
              <Trash2 size={15} /> Empezar de nuevo
            </button>
          </div>
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
