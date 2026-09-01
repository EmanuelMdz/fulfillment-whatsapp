import { useCallback, useEffect, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

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
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const [itemsRes, configRes] = await Promise.all([
      supabase.from('catalog_items').select('*').order('sort').order('created_at'),
      supabase.from('app_config').select('labels').eq('id', 1).maybeSingle(),
    ])
    if (!itemsRes.error) setItems(itemsRes.data ?? [])
    if (!configRes.error) setLabels(configRes.data?.labels ?? {})
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

  return (
    <>
      <h1 className="page-title">{nombrePlural}</h1>
      <p className="page-sub">
        La ficha de cada cosa (campo "Lo que la IA sabe") es lo que más mejora las respuestas.
      </p>
      {aviso && <p className={aviso.esError ? 'error-text' : 'ok-text'}>{aviso.texto}</p>}

      <div style={{ marginBottom: 10 }}>
        <button className="btn primary" onClick={nuevo}>
          <Plus size={15} /> {labels.item ? `Agregar ${labels.item.toLowerCase()}` : 'Agregar'}
        </button>
      </div>

      <div className="card">
        {items.length === 0 && <p className="muted">Catálogo vacío. El bot avisa que no tiene info cargada.</p>}
        {items.map((item) => (
          <div className="inbox-item" key={item.id}>
            <div className="body">
              <div className="title">
                {item.name}{' '}
                <span className="muted" style={{ fontWeight: 400 }}>
                  · ${item.price}
                  {item.track_stock ? ` · stock: ${item.stock_qty}` : ''}
                </span>{' '}
                {!item.active && <span className="chip">inactivo</span>}
              </div>
              {item.description && <p className="detail">{item.description}</p>}
            </div>
            <div className="actions">
              <button className="btn small" onClick={() => elegir(item)}>Editar</button>
            </div>
          </div>
        ))}
      </div>

      {seleccion && (
        <div className="card">
          <h2>{seleccion === 'nuevo' ? `Nuevo ${nombreItem.toLowerCase()}` : `Editar: ${form.name}`}</h2>
          <label className="field">
            <span>Nombre</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Precio (entero, en tu moneda)</span>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Descripción corta (lo que ve el cliente en una línea)</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="field">
            <span>
              Lo que la IA sabe y puede contar — texto libre: usos, garantía, respuestas a las
              preguntas típicas. Cuanto más completo, mejor contesta.
            </span>
            <textarea
              value={form.bot_info}
              onChange={(e) => setForm({ ...form, bot_info: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span>Activo — la IA lo ofrece y puede armar pedidos con esto</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.track_stock}
              onChange={(e) => setForm({ ...form, track_stock: e.target.checked })}
            />
            <span>Controlar existencias (módulo Inventario)</span>
          </label>
          {form.track_stock && (
            <label className="field">
              <span>Cantidad en stock</span>
              <input
                type="number"
                value={form.stock_qty}
                onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
              />
            </label>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={guardar} disabled={guardando || !form.name.trim()}>
              <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button className="btn" onClick={() => setSeleccion(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  )
}
