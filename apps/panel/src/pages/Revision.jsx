import { useCallback, useEffect, useState } from 'react'
import { Bot, Check, Inbox, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'
import { Badge, Button, Card, EmptyState, Notice, PageHeader } from '../ui'

/**
 * La bandeja del equipo: todo chat que necesita una persona cae acá —
 * lo derivó la IA (con un motivo del pack), lo frenó una guarda, o hay
 * un pedido esperando confirmación.
 *
 * "Resuelto" cierra el caso sin tocar el chat; "Devolver al bot" además
 * lo destraba (y despierta el turno si quedó un mensaje sin responder).
 */

// Los motivos de sistema (los ponen las guardas del código, no el pack).
const SISTEMA = {
  loop_detectado: 'El bot quedó en loop',
  respuesta_vacia: 'El modelo no devolvió respuesta',
  repeticion: 'El bot iba a repetirse',
  pedido_nuevo: 'Pedido para confirmar',
}

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
      <PageHeader
        title="Revisión"
        subtitle="Los chats que están esperando a una persona."
        actions={cargado && casos.length > 0 && <Badge tone="yellow">{casos.length} abiertos</Badge>}
      />
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      <Card padded={false} bodyClassName="py-1">
        {cargado && casos.length === 0 && (
          <EmptyState icon={Inbox} title="Nada pendiente" text="Todo atendido. Los casos nuevos aparecen acá solos." />
        )}
        <ul className="divide-y divide-line">
          {casos.map((caso) => {
            const conv = conversaciones[caso.conversation_id]
            const quien = conv
              ? conv.contact_name?.trim() || conv.contact_phone || conv.chat_id?.split('@')[0]
              : '…'
            const esSistema = caso.reason in SISTEMA
            return (
              <li key={caso.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{quien}</span>
                    <Badge tone={caso.reason === 'pedido_nuevo' ? 'green' : esSistema ? 'red' : 'yellow'}>
                      {motivos[caso.reason] ?? SISTEMA[caso.reason] ?? caso.reason}
                    </Badge>
                  </div>
                  {caso.detail && <p className="mt-1.5 text-[13px] whitespace-pre-wrap text-ink-2">{caso.detail}</p>}
                  {conv?.last_message && (
                    <p className="mt-1 truncate text-[12.5px] text-ink-3">Último mensaje: {conv.last_message}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" icon={MessageSquare} to={`/?chat=${caso.conversation_id}`}>
                    Abrir chat
                  </Button>
                  <Button size="sm" icon={Bot} onClick={() => devolver(caso)}>
                    Devolver al bot
                  </Button>
                  <Button size="sm" variant="primary" icon={Check} onClick={() => resolver(caso)}>
                    Resuelto
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </>
  )
}
