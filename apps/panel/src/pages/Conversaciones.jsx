import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeft, Bot, ContactRound, MessageSquare, Send, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'
import { Avatar, Badge, Button, Card, EmptyState, Notice, PageHeader, Textarea, WhatsappIcon } from '../ui'

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

const ESTADOS = {
  bot: { texto: 'Bot', tone: 'green' },
  humano: { texto: 'Humano', tone: 'violet' },
  cerrado: { texto: 'Cerrado', tone: 'neutral' },
}

function ChipEstado({ estado }) {
  const e = ESTADOS[estado] ?? { texto: estado, tone: 'neutral' }
  return <Badge tone={e.tone}>{e.texto}</Badge>
}

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
    <>
      <PageHeader
        title="Conversaciones"
        subtitle="El WhatsApp del negocio. Responder desde acá toma el control del chat."
        actions={lista.length > 0 && <Badge>{lista.length} chats</Badge>}
      />

      <Card className="overflow-hidden" padded={false} bodyClassName="flex h-[calc(100vh-215px)] min-h-[480px]">
        {/* ── Lista ── */}
        <div
          className={clsx(
            'w-full flex-col border-line md:flex md:w-[320px] md:shrink-0 md:border-r',
            seleccionada ? 'hidden' : 'flex',
          )}
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[12px] font-medium tracking-wide text-ink-3 uppercase">
            <WhatsappIcon size={14} className="text-brand" />
            Chats
          </div>
          <div className="flex-1 overflow-y-auto">
            {lista.length === 0 && (
              <EmptyState icon={WhatsappIcon} title="Todavía no hay chats" text="Cuando alguien escriba al número, aparece acá." />
            )}
            {lista.map((c) => (
              <button
                key={c.id}
                type="button"
                className={clsx(
                  'block w-full border-b border-line px-4 py-3 text-left transition-colors hover:bg-surface-2',
                  c.id === seleccionada && 'bg-surface-2',
                )}
                onClick={() => setSearchParams({ chat: c.id })}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={c.contact_name} email={c.contact_phone || c.chat_id} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold text-ink">{nombreDe(c)}</span>
                      <span className="shrink-0 text-[11.5px] text-ink-3">{cuando(c.last_message_at)}</span>
                    </div>
                    <p className="truncate text-[12.5px] text-ink-2">
                      {c.last_author === 'customer' ? '' : c.last_author === 'human' ? 'Vos: ' : 'Bot: '}
                      {c.last_message || '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-[46px]">
                  <ChipEstado estado={c.state} />
                  {c.review_reason && <Badge tone="yellow">Revisión</Badge>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Hilo ── */}
        <div className={clsx('min-w-0 flex-1 flex-col', seleccionada ? 'flex' : 'hidden md:flex')}>
          {!conv && (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={MessageSquare} title="Elegí una conversación" />
            </div>
          )}
          {conv && (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <Button size="sm" variant="ghost" icon={ArrowLeft} className="md:hidden" onClick={() => setSearchParams({})}>
                  Volver
                </Button>
                <span className="text-[14px] font-semibold text-ink">{nombreDe(conv)}</span>
                <ChipEstado estado={conv.state} />
                {conv.review_reason && (
                  <Badge tone="yellow" title={conv.review_reason}>
                    Revisión: {conv.review_reason}
                  </Badge>
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" icon={ContactRound} onClick={abrirFicha}>
                    {verFicha ? 'Volver al chat' : 'Ficha'}
                  </Button>
                  {conv.state !== 'bot' && (
                    <Button size="sm" icon={Bot} onClick={() => accion(() => api('/handback', { conversation_id: conv.id }))}>
                      Devolver al bot
                    </Button>
                  )}
                  {conv.state !== 'cerrado' && (
                    <Button
                      size="sm"
                      variant="danger"
                      icon={XCircle}
                      onClick={() => accion(() => api('/close', { conversation_id: conv.id }))}
                    >
                      Cerrar
                    </Button>
                  )}
                </div>
              </div>

              {verFicha ? (
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <h2 className="text-[15px] font-bold text-ink">Ficha</h2>
                  {!ficha && <p className="mt-2 text-[13px] text-ink-3">Cargando…</p>}
                  {ficha && !ficha.contacto && <p className="mt-2 text-[13px] text-ink-3">Este chat no tiene contacto asociado.</p>}
                  {ficha?.contacto && (
                    <>
                      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-[13.5px]">
                        <dt className="text-ink-3">Nombre</dt>
                        <dd className="text-ink">{ficha.contacto.name?.trim() || '—'}</dd>
                        <dt className="text-ink-3">Teléfono</dt>
                        <dd className="text-ink">{ficha.contacto.phone || '—'}</dd>
                        {Object.entries(ficha.contacto.collected ?? {}).map(([k, v]) => (
                          <span key={k} className="contents">
                            <dt className="text-ink-3">{k.replace(/_/g, ' ')}</dt>
                            <dd className="text-ink">{String(v)}</dd>
                          </span>
                        ))}
                      </dl>
                      <p className="mt-3 text-[12.5px] text-ink-3">
                        Los datos los junta la IA conversando; se corrigen solos cuando el cliente los corrige.
                      </p>
                      <h2 className="mt-6 text-[15px] font-bold text-ink">Pedidos</h2>
                      {ficha.pedidos.length === 0 && <p className="mt-2 text-[13px] text-ink-3">Ninguno todavía.</p>}
                      <ul className="mt-2 grid gap-2">
                        {ficha.pedidos.map((p) => (
                          <li key={p.id} className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13.5px]">
                            <span className="font-semibold text-ink">
                              {moneda}
                              {p.total}
                            </span>
                            <span className="text-ink-3">
                              {' '}
                              · {p.stage} · {new Date(p.created_at).toLocaleDateString('es-UY')}
                            </span>
                            <span className="mt-0.5 block text-ink-2">
                              {Array.isArray(p.items) ? p.items.map((i) => `${i.qty ?? 1}× ${i.name ?? '?'}`).join(' · ') : '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
                  {hilo.map((m) => (
                    <div
                      key={m.id}
                      className={clsx('bubble', m.direction === 'in' ? 'bubble-in' : 'bubble-out', m.author === 'human' && 'bubble-human')}
                    >
                      {m.body || (m.media_kind ? `[${m.media_kind}]` : '')}
                      <span className="bubble-meta">
                        {m.author === 'human' ? 'humano · ' : m.author === 'bot' ? 'bot · ' : ''}
                        {cuando(m.created_at)}
                      </span>
                    </div>
                  ))}
                  {pendientes.map((b, i) => (
                    <div key={`p-${i}`} className="bubble bubble-out bubble-human bubble-pending">
                      {b}
                      <span className="bubble-meta">en cola de envío…</span>
                    </div>
                  ))}
                  <div ref={finHilo} />
                </div>
              )}

              {error && (
                <Notice tone="error" className="mx-4 mb-2">
                  {error}
                </Notice>
              )}
              {!verFicha && (
                <form className="flex items-end gap-2 border-t border-line px-4 py-3" onSubmit={responder}>
                  <Textarea
                    className="min-h-11 flex-1 resize-none py-2.5"
                    rows={1}
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
                  <Button variant="primary" size="icon" type="submit" icon={Send} disabled={enviando || !texto.trim()} aria-label="Enviar" />
                </form>
              )}
            </>
          )}
        </div>
      </Card>
    </>
  )
}
