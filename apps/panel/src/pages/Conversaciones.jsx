import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bot, ContactRound, Send, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'

/**
 * El espejo del WhatsApp del negocio: lista de chats a la izquierda,
 * hilo a la derecha. En el teléfono navega como WhatsApp (lista → hilo
 * a pantalla completa).
 *
 * Responder desde acá toma el control del chat (el bot se calla);
 * "Devolver al bot" lo destraba. Los mensajes salen por la cola del
 * servidor — la burbuja tenue es un mensaje que todavía está en la cola.
 */

const REFRESCO_LISTA_MS = 7000
const REFRESCO_HILO_MS = 4000

function cuando(iso) {
  if (!iso) return ''
  const fecha = new Date(iso)
  const hoy = new Date().toDateString() === fecha.toDateString()
  const hora = fecha.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (hoy) return hora
  return `${fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })} ${hora}`
}

function nombreDe(conv) {
  return conv.contact_name?.trim() || conv.contact_phone || conv.chat_id?.split('@')[0] || 'Sin nombre'
}

const ESTADOS = { bot: 'Bot', humano: 'Humano', cerrado: 'Cerrado' }

export default function Conversaciones() {
  const [lista, setLista] = useState([])
  const [hilo, setHilo] = useState([])
  const [pendientes, setPendientes] = useState([]) // respuestas en cola de envío
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const seleccionada = searchParams.get('chat')
  const [verFicha, setVerFicha] = useState(false)
  const [ficha, setFicha] = useState(null) // {contacto, pedidos}
  const [moneda, setMoneda] = useState('$')
  const finHilo = useRef(null)

  useEffect(() => {
    supabase
      .from('app_config')
      .select('currency')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setMoneda(data?.currency || '$'))
  }, [])

  const conv = lista.find((c) => c.id === seleccionada) ?? null

  const cargarLista = useCallback(async () => {
    const { data, error } = await supabase
      .from('v_conversations_overview')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(150)
    if (!error) setLista(data ?? [])
  }, [])

  const cargarHilo = useCallback(async () => {
    if (!seleccionada) return
    const { data, error } = await supabase
      .from('messages')
      .select('id, author, direction, body, media_kind, created_at')
      .eq('conversation_id', seleccionada)
      .order('created_at', { ascending: true })
      .limit(300)
    if (!error && data) {
      setHilo(data)
      // Una pendiente que ya aparece en el hilo dejó de estar pendiente.
      setPendientes((p) => p.filter((b) => !data.some((m) => m.author === 'human' && m.body === b)))
    }
  }, [seleccionada])

  useEffect(() => {
    cargarLista()
    const t = setInterval(cargarLista, REFRESCO_LISTA_MS)
    return () => clearInterval(t)
  }, [cargarLista])

  useEffect(() => {
    setHilo([])
    setPendientes([])
    setVerFicha(false)
    setFicha(null)
    if (!seleccionada) return
    cargarHilo()
    const t = setInterval(cargarHilo, REFRESCO_HILO_MS)
    return () => clearInterval(t)
  }, [seleccionada, cargarHilo])

  async function abrirFicha() {
    if (verFicha) {
      setVerFicha(false)
      return
    }
    setVerFicha(true)
    if (!conv?.contact_id) {
      setFicha({ contacto: null, pedidos: [] })
      return
    }
    const [contactoRes, pedidosRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', conv.contact_id).maybeSingle(),
      supabase
        .from('orders')
        .select('id, items, total, stage, created_at')
        .eq('contact_id', conv.contact_id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    setFicha({
      contacto: contactoRes.data ?? null,
      pedidos: pedidosRes.data ?? [],
    })
  }

  useEffect(() => {
    finHilo.current?.scrollIntoView({ block: 'end' })
  }, [hilo.length, pendientes.length])

  async function responder(e) {
    e.preventDefault()
    const mensaje = texto.trim()
    if (!mensaje || !seleccionada || enviando) return
    setEnviando(true)
    setError(null)
    try {
      await api('/reply', { conversation_id: seleccionada, message: mensaje })
      setPendientes((p) => [...p, mensaje])
      setTexto('')
      cargarLista()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function accion(fn) {
    setError(null)
    try {
      await fn()
      await Promise.all([cargarLista(), cargarHilo()])
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={`chat ${seleccionada ? 'abierto' : ''}`}>
      <div className="chat-list">
        <div className="chat-list-head">Conversaciones</div>
        <div className="chat-list-body">
          {lista.length === 0 && <p className="muted" style={{ padding: '14px' }}>Todavía no hay chats.</p>}
          {lista.map((c) => (
            <button
              key={c.id}
              className={`conv-item ${c.id === seleccionada ? 'selected' : ''}`}
              onClick={() => setSearchParams({ chat: c.id })}
            >
              <div className="top">
                <span className="name">{nombreDe(c)}</span>
                <span className="when">{cuando(c.last_message_at)}</span>
              </div>
              <div className="preview">
                {c.last_author === 'customer' ? '' : c.last_author === 'human' ? 'Vos: ' : 'Bot: '}
                {c.last_message || '—'}
              </div>
              <div className="tags">
                <span className={`chip ${c.state}`}>{ESTADOS[c.state] ?? c.state}</span>
                {c.review_reason && <span className="chip review">Revisión</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="chat-thread">
        {!conv && <div className="thread-empty">Elegí una conversación.</div>}
        {conv && (
          <>
            <div className="thread-head">
              <button className="btn small back" onClick={() => setSearchParams({})}>
                <ArrowLeft size={15} /> Volver
              </button>
              <span className="who">{nombreDe(conv)}</span>
              <span className={`chip ${conv.state}`}>{ESTADOS[conv.state] ?? conv.state}</span>
              {conv.review_reason && (
                <span className="chip review" title={conv.review_reason}>Revisión: {conv.review_reason}</span>
              )}
              <button className="btn small" onClick={abrirFicha}>
                <ContactRound size={15} /> {verFicha ? 'Volver al chat' : 'Ficha'}
              </button>
              {conv.state !== 'bot' && (
                <button
                  className="btn small"
                  onClick={() => accion(() => api('/handback', { conversation_id: conv.id }))}
                >
                  <Bot size={15} /> Devolver al bot
                </button>
              )}
              {conv.state !== 'cerrado' && (
                <button
                  className="btn small danger"
                  onClick={() => accion(() => api('/close', { conversation_id: conv.id }))}
                >
                  <XCircle size={15} /> Cerrar
                </button>
              )}
            </div>

            {verFicha ? (
              <div className="ficha">
                <h2 style={{ marginTop: 0, fontSize: 15 }}>Ficha</h2>
                {!ficha && <p className="muted">Cargando…</p>}
                {ficha && !ficha.contacto && <p className="muted">Este chat no tiene contacto asociado.</p>}
                {ficha?.contacto && (
                  <>
                    <dl>
                      <dt>Nombre</dt>
                      <dd>{ficha.contacto.name?.trim() || '—'}</dd>
                      <dt>Teléfono</dt>
                      <dd>{ficha.contacto.phone || '—'}</dd>
                      {Object.entries(ficha.contacto.collected ?? {}).map(([k, v]) => (
                        <span key={k} style={{ display: 'contents' }}>
                          <dt>{k.replace(/_/g, ' ')}</dt>
                          <dd>{String(v)}</dd>
                        </span>
                      ))}
                    </dl>
                    <p className="muted" style={{ fontSize: 12.5 }}>
                      Los datos los junta la IA conversando; se corrigen solos cuando el cliente
                      los corrige.
                    </p>
                    <h2 style={{ fontSize: 15 }}>Pedidos</h2>
                    {ficha.pedidos.length === 0 && <p className="muted">Ninguno todavía.</p>}
                    {ficha.pedidos.map((p) => (
                      <div className="inbox-item" key={p.id}>
                        <div className="body">
                          <div className="title">
                            {moneda}{p.total}{' '}
                            <span className="muted" style={{ fontWeight: 400 }}>
                              · {p.stage} · {new Date(p.created_at).toLocaleDateString('es-UY')}
                            </span>
                          </div>
                          <p className="detail">
                            {Array.isArray(p.items)
                              ? p.items.map((i) => `${i.qty ?? 1}× ${i.name ?? '?'}`).join(' · ')
                              : '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="thread-body">
                {hilo.map((m) => (
                  <div
                    key={m.id}
                    className={`bubble ${m.direction === 'in' ? 'in' : 'out'} ${m.author === 'human' ? 'human' : ''}`}
                  >
                    {m.body || (m.media_kind ? `[${m.media_kind}]` : '')}
                    <span className="meta">
                      {m.author === 'human' ? 'humano · ' : m.author === 'bot' ? 'bot · ' : ''}
                      {cuando(m.created_at)}
                    </span>
                  </div>
                ))}
                {pendientes.map((b, i) => (
                  <div key={`p-${i}`} className="bubble out human pendiente">
                    {b}
                    <span className="meta">en cola de envío…</span>
                  </div>
                ))}
                <div ref={finHilo} />
              </div>
            )}

            {error && <p className="error-text" style={{ margin: '4px 12px' }}>{error}</p>}
            {!verFicha && (
              <form className="composer" onSubmit={responder}>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Responder como humano (el bot se calla en este chat)…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      responder(e)
                    }
                  }}
                />
                <button className="btn primary" type="submit" disabled={enviando || !texto.trim()}>
                  <Send size={16} />
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
