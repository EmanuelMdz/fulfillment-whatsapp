import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

/**
 * Los pedidos — ventas en una tienda, consultas en una clínica. El
 * nombre y los estados salen de la configuración del pack: acá no hay
 * ni un "Venta" escrito fijo.
 *
 * Los que armó el bot nacen en la primera etapa esperando confirmación:
 * se revisan, se les cambia la etapa, y la confirmación al cliente se
 * escribe desde su chat (botón Abrir chat).
 */
export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [config, setConfig] = useState(null)
  const [soloAbiertos, setSoloAbiertos] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const cargar = useCallback(async () => {
    const [pedidosRes, configRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, contacts(name, phone)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('app_config').select('labels, order_stages').eq('id', 1).maybeSingle(),
    ])
    if (!pedidosRes.error) setPedidos(pedidosRes.data ?? [])
    if (!configRes.error) setConfig(configRes.data)
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 15000)
    return () => clearInterval(t)
  }, [cargar])

  const etapas = config?.order_stages ?? []
  const finales = new Set(etapas.filter((e) => e.final).map((e) => e.key))
  const nombrePlural = config?.labels?.order_plural ?? 'Pedidos'
  const visibles = soloAbiertos ? pedidos.filter((p) => !finales.has(p.stage)) : pedidos

  async function cambiarEtapa(pedido, stage) {
    setError(null)
    const { error } = await supabase.from('orders').update({ stage }).eq('id', pedido.id)
    if (error) setError(error.message)
    else cargar()
  }

  async function abrirChat(pedido) {
    if (!pedido.contact_id) return
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', pedido.contact_id)
      .limit(1)
      .maybeSingle()
    if (data) navigate(`/?chat=${data.id}`)
    else setError('Este contacto no tiene chat.')
  }

  function renderItems(items) {
    if (!Array.isArray(items) || !items.length) return '—'
    return items.map((i) => `${i.qty ?? 1}× ${i.name ?? '?'}`).join(' · ')
  }

  return (
    <>
      <h1 className="page-title">{nombrePlural}</h1>
      <p className="page-sub">
        Los que armó el bot llegan en la primera etapa, esperando que alguien los confirme.
      </p>
      {error && <p className="error-text">{error}</p>}

      <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
        <button className={`btn small ${soloAbiertos ? 'primary' : ''}`} onClick={() => setSoloAbiertos(true)}>
          Abiertos
        </button>
        <button className={`btn small ${!soloAbiertos ? 'primary' : ''}`} onClick={() => setSoloAbiertos(false)}>
          Todos
        </button>
      </div>

      <div className="card">
        {visibles.length === 0 && <p className="muted">Nada por acá todavía.</p>}
        {visibles.map((p) => (
          <div className="inbox-item" key={p.id}>
            <div className="body">
              <div className="title">
                {p.contacts?.name?.trim() || p.contacts?.phone || 'Sin contacto'}
                {'  '}
                <span className="muted" style={{ fontWeight: 400 }}>
                  · ${p.total} · {new Date(p.created_at).toLocaleDateString('es-UY')}
                  {p.source === 'bot' ? ' · lo armó el bot' : ''}
                </span>
              </div>
              <p className="detail">{renderItems(p.items)}</p>
              {p.notes && <p className="detail">Nota: {p.notes}</p>}
            </div>
            <div className="actions">
              <select
                className="btn small"
                value={p.stage}
                onChange={(e) => cambiarEtapa(p, e.target.value)}
              >
                {etapas.map((e) => (
                  <option key={e.key} value={e.key}>{e.label}</option>
                ))}
                {!etapas.some((e) => e.key === p.stage) && (
                  <option value={p.stage}>{p.stage}</option>
                )}
              </select>
              {p.contact_id && (
                <button className="btn small" onClick={() => abrirChat(p)}>
                  <MessageSquare size={15} /> Abrir chat
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
