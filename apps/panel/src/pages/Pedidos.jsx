import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { Badge, Button, Card, EmptyState, Notice, PageHeader, Select, Table } from '../ui'

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
      supabase.from('app_config').select('labels, order_stages, currency').eq('id', 1).maybeSingle(),
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
  const moneda = config?.currency ?? '$'
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

  const columnas = [
    {
      key: 'contacto',
      label: 'Contacto',
      render: (p) => (
        <div>
          <span className="font-semibold text-ink">{p.contacts?.name?.trim() || p.contacts?.phone || 'Sin contacto'}</span>
          {p.source === 'bot' && (
            <Badge tone="green" className="ml-2">
              lo armó el bot
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'detalle',
      label: 'Detalle',
      render: (p) => (
        <div className="text-ink-2">
          <span>{renderItems(p.items)}</span>
          {p.notes && <span className="block text-[12.5px] text-ink-3">Nota: {p.notes}</span>}
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (p) => (
        <span className="font-semibold tabular-nums text-ink">
          {moneda}
          {p.total}
        </span>
      ),
    },
    {
      key: 'fecha',
      label: 'Fecha',
      render: (p) => <span className="text-ink-2">{new Date(p.created_at).toLocaleDateString('es-UY')}</span>,
    },
    {
      key: 'etapa',
      label: 'Etapa',
      render: (p) => (
        <Select
          className="h-8 w-auto min-w-36 py-1 text-[13px]"
          value={p.stage}
          onChange={(e) => cambiarEtapa(p, e.target.value)}
        >
          {etapas.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
          {!etapas.some((e) => e.key === p.stage) && <option value={p.stage}>{p.stage}</option>}
        </Select>
      ),
    },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      render: (p) =>
        p.contact_id ? (
          <Button size="sm" icon={MessageSquare} onClick={() => abrirChat(p)}>
            Abrir chat
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title={nombrePlural}
        subtitle="Los que armó el bot llegan en la primera etapa, esperando que alguien los confirme."
        actions={
          <>
            <Button size="sm" variant={soloAbiertos ? 'dark' : 'default'} onClick={() => setSoloAbiertos(true)}>
              Abiertos
            </Button>
            <Button size="sm" variant={!soloAbiertos ? 'dark' : 'default'} onClick={() => setSoloAbiertos(false)}>
              Todos
            </Button>
          </>
        }
      />
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      <Card>
        {visibles.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nada por acá todavía" text="Cuando el bot anote uno, aparece acá." />
        ) : (
          <Table columns={columnas} rows={visibles} />
        )}
      </Card>
    </>
  )
}
