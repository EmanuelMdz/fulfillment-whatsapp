import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ClipboardList, Inbox, MessageSquare, Send } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { AreaTrend, Badge, Button, Card, EmptyState, Kpi, Notice, PageHeader, Table, WhatsappIcon } from '../ui'

/**
 * Métricas de los últimos 7 días: cuatro números con sus barritas por
 * día, la curva de respuestas del bot, lo que está en revisión ahora y
 * los últimos pedidos. Todo sale de las tablas y del registro de eventos.
 */

const DIAS = 7
const DIA_MS = 24 * 60 * 60 * 1000

/** Los últimos 7 días como [{ clave: '2026-09-02', dia: 'mié' }], del más viejo al más nuevo. */
function ultimosDias() {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Array.from({ length: DIAS }, (_, i) => {
    const d = new Date(hoy.getTime() - (DIAS - 1 - i) * DIA_MS)
    return { clave: d.toDateString(), dia: d.toLocaleDateString('es-UY', { weekday: 'short' }).replace('.', '') }
  })
}

/** Cuenta filas por día (según created_at) sobre la grilla de días. */
function porDia(filas, dias) {
  const conteo = new Map(dias.map((d) => [d.clave, 0]))
  for (const f of filas) {
    const clave = new Date(f.created_at).toDateString()
    if (conteo.has(clave)) conteo.set(clave, conteo.get(clave) + 1)
  }
  return dias.map((d) => conteo.get(d.clave))
}

/** Variación de la segunda mitad de la semana contra la primera. */
function variacion(serie) {
  const mitad = Math.floor(serie.length / 2)
  const antes = serie.slice(0, mitad).reduce((s, v) => s + v, 0)
  const despues = serie.slice(mitad).reduce((s, v) => s + v, 0)
  if (!antes && !despues) return null
  if (!antes) return { text: 'nuevo', tone: 'green' }
  const pct = Math.round(((despues - antes) / antes) * 100)
  return { text: `${pct >= 0 ? '+' : ''}${pct}%`, tone: pct >= 0 ? 'green' : 'red' }
}

export default function Metricas() {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    const dias = ultimosDias()
    const desde = new Date(Date.now() - DIAS * DIA_MS).toISOString()
    async function cargar() {
      const [eventos, chats, pedidos, revision, config] = await Promise.all([
        supabase
          .from('event_log')
          .select('event_type, created_at')
          .in('event_type', ['turn.answered', 'review.queued', 'followup.sent', 'turn.failed'])
          .gte('created_at', desde)
          .limit(5000),
        supabase.from('conversations').select('created_at').gte('created_at', desde),
        supabase
          .from('orders')
          .select('id, total, stage, source, created_at, items, contacts(name, phone)')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('review_queue').select('id, reason, detail, conversation_id, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(6),
        supabase.from('app_config').select('currency, order_stages, escalation_reasons, labels').eq('id', 1).maybeSingle(),
      ])
      const ev = eventos.data ?? []
      const tipo = (t) => ev.filter((e) => e.event_type === t)
      const pedidosBot = (pedidos.data ?? []).filter((p) => p.source === 'bot' && p.created_at >= desde)
      setDatos({
        dias,
        chats: porDia(chats.data ?? [], dias),
        respuestas: porDia(tipo('turn.answered'), dias),
        derivaciones: porDia(tipo('review.queued'), dias),
        seguimientos: porDia(tipo('followup.sent'), dias),
        caidos: tipo('turn.failed').length,
        pedidosBot: pedidosBot.length,
        pedidosTotal: pedidosBot.reduce((s, p) => s + (p.total ?? 0), 0),
        ultimosPedidos: pedidos.data ?? [],
        revision: revision.data ?? [],
        moneda: config.data?.currency || '$',
        etapas: Object.fromEntries((config.data?.order_stages ?? []).map((e) => [e.key, e])),
        motivos: Object.fromEntries((config.data?.escalation_reasons ?? []).map((m) => [m.key, m.label])),
        labels: config.data?.labels ?? {},
      })
    }
    cargar()
  }, [])

  if (!datos) return <p className="text-ink-3">Calculando…</p>

  const suma = (s) => s.reduce((a, b) => a + b, 0)
  const curva = datos.dias.map((d, i) => ({ dia: d.dia, valor: datos.respuestas[i] }))
  const nombrePedidos = datos.labels.order_plural ?? 'Pedidos'

  const columnasPedidos = [
    {
      key: 'contacto',
      label: 'Contacto',
      render: (p) => <span className="font-semibold text-ink">{p.contacts?.name?.trim() || p.contacts?.phone || 'Sin contacto'}</span>,
    },
    {
      key: 'items',
      label: 'Detalle',
      render: (p) => (
        <span className="text-ink-2">
          {Array.isArray(p.items) && p.items.length ? p.items.map((i) => `${i.qty ?? 1}× ${i.name ?? '?'}`).join(' · ') : '—'}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (p) => (
        <span className="font-semibold tabular-nums text-ink">
          {datos.moneda}
          {p.total}
        </span>
      ),
    },
    {
      key: 'stage',
      label: 'Etapa',
      align: 'right',
      render: (p) => {
        const etapa = datos.etapas[p.stage]
        return <Badge tone={etapa?.final ? 'blue' : 'yellow'}>{etapa?.label ?? p.stage}</Badge>
      },
    },
  ]

  return (
    <>
      <PageHeader title="Métricas" subtitle="Los últimos 7 días. Si algo se está rompiendo, se ve acá primero." />

      {datos.caidos > 0 && (
        <Notice tone="error" className="mb-5" action={<Button size="sm" to="/revision">Ver revisión</Button>}>
          Hubo {datos.caidos} turno(s) caído(s) esta semana: clientes que escribieron y quedaron sin respuesta.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={WhatsappIcon}
          tone="violet"
          label="Chats nuevos"
          value={suma(datos.chats)}
          delta={variacion(datos.chats)}
          spark={datos.chats}
          note="Conversaciones que empezaron esta semana"
        />
        <Kpi
          icon={MessageSquare}
          tone="green"
          label="Respuestas del bot"
          value={suma(datos.respuestas)}
          delta={variacion(datos.respuestas)}
          spark={datos.respuestas}
          note="Turnos contestados por la IA"
        />
        <Kpi
          icon={ClipboardList}
          tone="orange"
          label={`${nombrePedidos} del bot`}
          value={datos.pedidosBot}
          delta={datos.pedidosTotal ? { text: `${datos.moneda}${datos.pedidosTotal}`, tone: 'neutral' } : null}
          note="Anotados por la IA, esperando confirmación o ya confirmados"
        />
        <Kpi
          icon={Inbox}
          tone="blue"
          label="Derivaciones"
          value={suma(datos.derivaciones)}
          delta={variacion(datos.derivaciones)}
          spark={datos.derivaciones}
          note={`${suma(datos.seguimientos)} seguimientos enviados`}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card title="Respuestas del bot" subtitle="Cuántos mensajes contestó la IA cada día">
          <AreaTrend data={curva} nombre="Respuestas" height={240} />
        </Card>

        <Card
          title="En revisión ahora"
          subtitle="Chats esperando a una persona"
          actions={
            datos.revision.length > 0 && (
              <Button size="sm" to="/revision">
                Ver todos
              </Button>
            )
          }
        >
          {datos.revision.length === 0 ? (
            <EmptyState icon={Inbox} title="Nada pendiente" text="Todo atendido." />
          ) : (
            <ul className="grid gap-2">
              {datos.revision.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/?chat=${c.conversation_id}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-3 transition-colors hover:bg-line/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">
                        {datos.motivos[c.reason] ?? c.reason.replace(/_/g, ' ')}
                      </span>
                      {c.detail && <span className="block truncate text-[12px] text-ink-3">{c.detail}</span>}
                    </span>
                    <Send size={14} className="shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        className="mt-5"
        title={`Últimos ${nombrePedidos.toLowerCase()}`}
        actions={
          <Button size="sm" to="/pedidos">
            Ver todos
          </Button>
        }
      >
        {datos.ultimosPedidos.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="Todavía no hay pedidos" text="Cuando el bot anote uno, aparece acá." />
        ) : (
          <Table columns={columnasPedidos} rows={datos.ultimosPedidos} />
        )}
      </Card>
    </>
  )
}
