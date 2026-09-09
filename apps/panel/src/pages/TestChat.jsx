import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Clock, Eye, EyeOff, Send, Trash2 } from 'lucide-react'
import { api } from '../lib/api.js'
import { Button, Card, Notice, PageHeader, Textarea } from '../ui'

/**
 * Probar el bot sin gastar un número: el mismo contexto, el mismo
 * contrato del turno real — pero acá, y mostrando la DECISIÓN completa.
 *
 * Debajo de cada respuesta se ve lo que en producción es invisible: si
 * hubiera derivado (y por qué), qué datos hubiera guardado en la ficha
 * y qué datos del lead guardaría. Es la mejor forma de afinar los prompts
 * y la ficha del catálogo antes de conectar el número.
 *
 * Dos herramientas más: "Lo que lee la IA" muestra el prompt completo
 * tal como lo recibe el modelo (nombre, prompts, fecha, catálogo con
 * ids, motivos), y "¿Qué recordatorio mandaría?" corre el agente de
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
      <PageHeader
        title="Probar el bot"
        subtitle="Charlá como si fueras un cliente. Nada de esto toca los chats reales ni la base."
        actions={
          <>
            <Button size="sm" icon={verContexto ? EyeOff : Eye} onClick={alternarContexto} title="El prompt completo, tal como lo recibe el modelo">
              Lo que lee la IA
            </Button>
            <Button
              size="sm"
              icon={Clock}
              onClick={probarSeguimientos}
              disabled={!mensajes.length || pensandoSeg}
              title="Corre el agente de seguimientos sobre esta charla, sin agendar nada"
            >
              {pensandoSeg ? 'Pensando…' : '¿Qué recordatorio mandaría?'}
            </Button>
            <Button
              size="sm"
              icon={Trash2}
              onClick={() => {
                setMensajes([])
                setSeguimientos(null)
                setError(null)
              }}
            >
              Empezar de nuevo
            </Button>
          </>
        }
      />

      <div className={clsx('grid gap-5', verContexto && 'xl:grid-cols-[1fr_420px]')}>
        <Card padded={false} bodyClassName="flex h-[calc(100vh-220px)] min-h-[420px] flex-col" className="overflow-hidden">
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-5">
            {mensajes.length === 0 && (
              <p className="text-[13.5px] text-ink-3">Escribí el primer mensaje, como lo escribiría un cliente.</p>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={clsx('bubble', m.role === 'user' ? 'bubble-in' : 'bubble-out')}>
                {m.content}
                {m.meta && (m.meta.derivar || m.meta.datos) && (
                  <span className="bubble-meta">
                    {m.meta.derivar ? `derivaría: ${m.meta.derivar} · ` : ''}
                    {m.meta.datos ? `ficha: ${Object.keys(m.meta.datos).join(', ')} · ` : ''}
                  </span>
                )}
              </div>
            ))}
            {pensando && <div className="bubble bubble-out bubble-pending">pensando…</div>}
            {seguimientos && (
              <ul className="mt-2 grid gap-2">
                {seguimientos.length === 0 && <li className="text-[13px] text-ink-3">No mandaría ningún recordatorio.</li>}
                {seguimientos.map((s, i) => (
                  <li key={i} className="rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13.5px]">
                    <span className="font-semibold text-ink">En {s.en_horas} h</span>{' '}
                    <span className="text-ink-3">({cuando(s.cuando)})</span>
                    <span className="mt-1 block text-ink-2">{s.mensaje}</span>
                  </li>
                ))}
              </ul>
            )}
            <div ref={fin} />
          </div>
          {error && (
            <Notice tone="error" className="mx-5 mb-2">
              {error}
            </Notice>
          )}
          <form className="flex items-end gap-2 border-t border-line px-4 py-3" onSubmit={mandar}>
            <Textarea
              className="min-h-11 flex-1 resize-none py-2.5"
              rows={1}
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
            <Button variant="primary" size="icon" type="submit" icon={Send} disabled={pensando || !texto.trim()} aria-label="Enviar" />
          </form>
        </Card>

        {verContexto && (
          <Card title="Lo que lee la IA" subtitle="El prompt completo, tal como lo recibe el modelo" className="self-start">
            <pre className="max-h-[calc(100vh-300px)] overflow-auto rounded-xl bg-surface-2 p-3.5 text-[12px] leading-[1.5] whitespace-pre-wrap text-ink-2">
              {contexto ?? 'Armando…'}
            </pre>
          </Card>
        )}
      </div>
    </>
  )
}
