import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Métricas de los últimos 7 días. Sin gráficos rebuscados: seis números
 * que dicen si el bot está trabajando y si algo se está rompiendo.
 * Todo sale de las tablas y del registro de eventos (event_log).
 */

async function contar(tabla, filtros) {
  let q = supabase.from(tabla).select('*', { count: 'exact', head: true })
  for (const f of filtros) q = q[f[0]](...f.slice(1))
  const { count, error } = await q
  return error ? null : (count ?? 0)
}

export default function Metricas() {
  const [kpis, setKpis] = useState(null)

  useEffect(() => {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    async function cargar() {
      const [nuevas, turnos, derivaciones, seguimientos, caidos, enRevision, pedidosRes, configRes] =
        await Promise.all([
          contar('conversations', [['gte', 'created_at', desde]]),
          contar('event_log', [['eq', 'event_type', 'turn.answered'], ['gte', 'created_at', desde]]),
          contar('event_log', [['eq', 'event_type', 'review.queued'], ['gte', 'created_at', desde]]),
          contar('event_log', [['eq', 'event_type', 'followup.sent'], ['gte', 'created_at', desde]]),
          contar('event_log', [['eq', 'event_type', 'turn.failed'], ['gte', 'created_at', desde]]),
          contar('review_queue', [['eq', 'status', 'open']]),
          supabase.from('orders').select('total').eq('source', 'bot').gte('created_at', desde),
          supabase.from('app_config').select('currency').eq('id', 1).maybeSingle(),
        ])
      const pedidos = pedidosRes.error ? [] : (pedidosRes.data ?? [])
      setKpis({
        moneda: configRes.data?.currency || '$',
        nuevas,
        turnos,
        derivaciones,
        seguimientos,
        caidos,
        enRevision,
        pedidos: pedidos.length,
        pedidosTotal: pedidos.reduce((s, p) => s + (p.total ?? 0), 0),
      })
    }
    cargar()
  }, [])

  const CAJAS = kpis
    ? [
        { titulo: 'Chats nuevos', valor: kpis.nuevas },
        { titulo: 'Respuestas del bot', valor: kpis.turnos },
        { titulo: 'Pedidos del bot', valor: `${kpis.pedidos} · ${kpis.moneda}${kpis.pedidosTotal}` },
        { titulo: 'Seguimientos enviados', valor: kpis.seguimientos },
        { titulo: 'Derivaciones', valor: kpis.derivaciones },
        { titulo: 'En revisión ahora', valor: kpis.enRevision },
        { titulo: 'Turnos caídos', valor: kpis.caidos, alerta: kpis.caidos > 0 },
      ]
    : []

  return (
    <>
      <h1 className="page-title">Métricas</h1>
      <p className="page-sub">Los últimos 7 días. Si "turnos caídos" no está en cero, hay clientes que quedaron sin respuesta: mirá el registro de eventos.</p>

      {!kpis && <p className="muted">Calculando…</p>}
      <div className="kpis">
        {CAJAS.map((c) => (
          <div className={`kpi ${c.alerta ? 'alerta' : ''}`} key={c.titulo}>
            <div className="kpi-valor">{c.valor ?? '—'}</div>
            <div className="kpi-titulo">{c.titulo}</div>
          </div>
        ))}
      </div>
    </>
  )
}
