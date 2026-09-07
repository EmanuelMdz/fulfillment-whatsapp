import { useCallback, useEffect, useState } from 'react'
import { Package, Pencil, Plus, Save } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Notice, PageHeader, Table, Textarea } from '../ui'

/**
 * El catálogo — productos en una tienda, prestaciones en una clínica.
 *
 * El campo que importa de verdad es `bot_info`: la ficha larga que la IA
 * sabe y puede contar. Mueve más la calidad de las respuestas que
 * cualquier prompt — acá es donde se le enseña al bot QUÉ vende.
 */

const VACIO = {
  name: '',
  kind: 'product',
  price: 0,
  description: '',
  bot_info: '',
  active: true,
  track_stock: false,
  stock_qty: 0,
}

export default function Catalogo() {
  const [items, setItems] = useState([])
  const [seleccion, setSeleccion] = useState(null) // null = nada, 'nuevo' = alta
  const [form, setForm] = useState(VACIO)
  const [labels, setLabels] = useState({})
  const [moneda, setMoneda] = useState('$')
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const [itemsRes, configRes] = await Promise.all([
      supabase.from('catalog_items').select('*').order('sort').order('created_at'),
      supabase.from('app_config').select('labels, currency').eq('id', 1).maybeSingle(),
    ])
    if (!itemsRes.error) setItems(itemsRes.data ?? [])
    if (!configRes.error) {
      setLabels(configRes.data?.labels ?? {})
      setMoneda(configRes.data?.currency || '$')
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function avisar(texto, esError = false) {
    setAviso({ texto, esError })
    setTimeout(() => setAviso(null), 3500)
  }

  function elegir(item) {
    setSeleccion(item.id)
    setForm({ ...item })
  }

  function nuevo() {
    setSeleccion('nuevo')
    setForm({ ...VACIO })
  }

  async function guardar() {
    setGuardando(true)
    const fila = {
      name: form.name.trim(),
      kind: form.kind,
      price: Number(form.price) || 0,
      description: form.description,
      bot_info: form.bot_info,
      active: form.active,
      track_stock: form.track_stock,
      stock_qty: Number(form.stock_qty) || 0,
    }
    const res =
      seleccion === 'nuevo'
        ? await supabase.from('catalog_items').insert(fila)
        : await supabase.from('catalog_items').update(fila).eq('id', seleccion)
    setGuardando(false)
    if (res.error) {
      avisar(`No se pudo guardar: ${res.error.message}`, true)
    } else {
      avisar('Guardado. El bot ya lo ve así en su próximo turno.')
      setSeleccion(null)
      cargar()
    }
  }

  const nombreItem = labels.item ?? 'Producto'
  const nombrePlural = labels.item_plural ?? 'Catálogo'

  const columnas = [
    {
      key: 'name',
      label: 'Nombre',
      render: (i) => (
        <div>
          <span className="font-semibold text-ink">{i.name}</span>
          {i.description && <span className="block text-[12.5px] text-ink-3">{i.description}</span>}
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Precio',
      align: 'right',
      render: (i) => (
        <span className="font-semibold tabular-nums text-ink">
          {moneda}
          {i.price}
        </span>
      ),
    },
    {
      key: 'stock',
      label: 'Stock',
      render: (i) => (i.track_stock ? <span className="tabular-nums text-ink-2">{i.stock_qty}</span> : <span className="text-ink-3">—</span>),
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (i) => (i.active ? <Badge tone="green">activo</Badge> : <Badge>inactivo</Badge>),
    },
    {
      key: 'acciones',
      label: '',
      align: 'right',
      render: (i) => (
        <Button size="sm" icon={Pencil} onClick={() => elegir(i)}>
          Editar
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={nombrePlural}
        subtitle='La ficha de cada cosa (campo "Lo que la IA sabe") es lo que más mejora las respuestas.'
        actions={
          <Button variant="primary" icon={Plus} onClick={nuevo}>
            {labels.item ? `Agregar ${labels.item.toLowerCase()}` : 'Agregar'}
          </Button>
        }
      />
      {aviso && (
        <Notice tone={aviso.esError ? 'error' : 'ok'} className="mb-4">
          {aviso.texto}
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card>
          {items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Catálogo vacío"
              text="El bot avisa que no tiene información cargada. Agregá lo primero que vendés."
            />
          ) : (
            <Table columns={columnas} rows={items} />
          )}
        </Card>

        {seleccion && (
          <Card
            title={seleccion === 'nuevo' ? `Nuevo ${nombreItem.toLowerCase()}` : `Editar: ${form.name}`}
            className="self-start lg:sticky lg:top-6"
          >
            <div className="grid gap-4">
              <Field label="Nombre">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={`Precio (entero, en ${moneda})`}>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </Field>
              <Field label="Descripción corta (lo que ve el cliente en una línea)">
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field
                label="Lo que la IA sabe y puede contar"
                hint="Texto libre: usos, garantía, respuestas a las preguntas típicas. Cuanto más completo, mejor contesta."
              >
                <Textarea value={form.bot_info} onChange={(e) => setForm({ ...form, bot_info: e.target.value })} />
              </Field>
              <Checkbox
                label="Activo — la IA lo ofrece y puede armar pedidos con esto"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <Checkbox
                label="Controlar existencias (módulo Inventario)"
                checked={form.track_stock}
                onChange={(e) => setForm({ ...form, track_stock: e.target.checked })}
              />
              {form.track_stock && (
                <Field label="Cantidad en stock">
                  <Input
                    type="number"
                    value={form.stock_qty}
                    onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                  />
                </Field>
              )}
              <div className="flex gap-2">
                <Button variant="primary" icon={Save} onClick={guardar} disabled={guardando || !form.name.trim()}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button onClick={() => setSeleccion(null)}>Cancelar</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
