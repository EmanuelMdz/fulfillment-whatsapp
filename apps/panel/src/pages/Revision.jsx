import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Check, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'

/**
 * La bandeja del equipo: todo chat que necesita una persona cae acá —
 * lo derivó la IA (con un motivo del pack), lo frenó una guarda, o hay
 * un pedido esperando confirmación.
 *
 * "Resuelto" cierra el caso sin tocar el chat; "Devolver al bot" además
 * lo destraba (y despierta el turno si quedó un mensaje sin responder).
 */
export default function Revision() {
  const [casos, setCasos] = useState([])
  const [conversaciones, setConversaciones] = useState({})
  const [motivos, setMotivos] = useState({})
  const [error, setError] = useState(null)
  const [cargado, setCargado] = useState(false)

  const cargar = useCallback(async () => {
    const [casosRes, configRes] = await Promise.all([
      supabase
        .from('review_queue')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase.from('app_config').select('escalation_reasons').eq('id', 1).maybeSingle(),
    ])
    if (casosRes.error) return

    const abiertos = casosRes.data ?? []
    setCasos(abiertos)
    setCargado(true)

    const etiquetas = {}
    for (const m of configRes.data?.escalation_reasons ?? []) etiquetas[m.key] = m.label
    setMotivos(etiquetas)

    if (abiertos.length) {
      const ids = [...new Set(abiertos.map((c) => c.conversation_id))]
      const { data: convs } = await supabase
        .from('v_conversations_overview')
        .select('*')
        .in('id', ids)
      const porId = {}
      for (const c of convs ?? []) porId[c.id] = c
      setConversaciones(porId)
    }
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 10000)
    return () => clearInterval(t)
  }, [cargar])

  // Los motivos de sistema (los ponen las guardas del código, no el pack).
  const SISTEMA = {
    loop_detectado: 'El bot quedó en loop',
    respuesta_vacia: 'El modelo no devolvió respuesta',
    repeticion: 'El bot iba a repetirse',
    pedido_nuevo: 'Pedido para confirmar',
  }

  async function resolver(caso) {
    setError(null)
    const { error } = await supabase
      .from('review_queue')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', caso.id)
    if (error) setError(error.message)
    else cargar()
  }

  async function devolver(caso) {
    setError(null)
    try {
      await api('/handback', { conversation_id: caso.conversation_id })
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h1 className="page-title">Revisión</h1>
      <p className="page-sub">Los chats que están esperando a una persona.</p>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        {cargado && casos.length === 0 && <p className="muted">Nada pendiente. Todo atendido.</p>}
        {casos.map((caso) => {
          const conv = conversaciones[caso.conversation_id]
          const quien = conv
            ? conv.contact_name?.trim() || conv.contact_phone || conv.chat_id?.split('@')[0]
            : '…'
          return (
            <div className="inbox-item" key={caso.id}>
              <div className="body">
                <div className="title">{quien}</div>
                <span className="chip review">
                  {motivos[caso.reason] ?? SISTEMA[caso.reason] ?? caso.reason}
                </span>
                {caso.detail && <p className="detail">{caso.detail}</p>}
                {conv?.last_message && (
                  <p className="detail">Último mensaje: {conv.last_message}</p>
                )}
              </div>
              <div className="actions">
                <Link className="btn small" to={`/?chat=${caso.conversation_id}`}>
                  <MessageSquare size={15} /> Abrir chat
                </Link>
                <button className="btn small" onClick={() => devolver(caso)}>
                  <Bot size={15} /> Devolver al bot
                </button>
                <button className="btn small" onClick={() => resolver(caso)}>
                  <Check size={15} /> Resuelto
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
