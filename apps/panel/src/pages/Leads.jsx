import { useCallback, useEffect, useState } from 'react'
import { ContactRound, RefreshCw, Save } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Table } from '../ui'

const PAGE_SIZE = 100

/** Las etapas y los demás datos son texto libre definido por el prompt. */
export default function Leads() {
  const [rows, setRows] = useState([])
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [stage, setStage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const cargar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('contacts').select('id, name, phone, collected, notes, created_at')
      .order('created_at', { ascending: false }).order('id').limit(limit)
    if (error) setError(error.message)
    else { setRows(data ?? []); setError(null) }
    setLoading(false)
  }, [limit])
  useEffect(() => { cargar() }, [cargar])

  async function guardarEtapa() {
    setBusy(true)
    setError(null)
    try {
      await api('/lead-data', { contact_id: selected.id, data: { etapa: stage.trim() } })
      const updated = { ...selected, collected: { ...selected.collected, etapa: stage.trim() } }
      setSelected(updated)
      setRows((rows) => rows.map((row) => row.id === updated.id ? updated : row))
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const visible = rows.filter((row) =>
    [row.name, row.phone, ...Object.values(row.collected ?? {})].join(' ').toLowerCase().includes(search.toLowerCase().trim()),
  )
  const columns = [
    { key: 'name', label: 'Lead', render: (row) => <span className="break-words">{row.name || row.collected?.nombre_completo || 'Sin nombre'}</span> },
    { key: 'phone', label: 'Teléfono', render: (row) => <span className="break-all">{row.phone || '—'}</span> },
    { key: 'stage', label: 'Etapa', render: (row) => <Badge>{row.collected?.etapa || 'Sin etapa'}</Badge> },
    { key: 'detail', label: 'Ficha', render: (row) => <Button size="sm" icon={ContactRound} onClick={() => { setSelected(row); setStage(row.collected?.etapa || '') }} disabled={busy}>Ver ficha</Button> },
  ]

  return <>
    <PageHeader title="Leads" subtitle="Los contactos y la información que el agente recopila según tu prompt."
      actions={<Button icon={RefreshCw} onClick={cargar} disabled={loading}>Actualizar</Button>} />
    {error && <Notice tone="error" className="mb-4">{error}</Notice>}
    <div className="grid gap-5">
      <Card>
        <Field label="Buscar en los leads cargados">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, teléfono o dato de la ficha" />
        </Field>
        <div className="mt-4">
          {loading ? <p>Cargando…</p> : <Table columns={columns} rows={visible} empty="Todavía no hay leads que coincidan. Se crean cuando llega una conversación." />}
        </div>
        {rows.length >= limit && <Button className="mt-4" onClick={() => setLimit(limit + PAGE_SIZE)} disabled={loading}>Cargar más</Button>}
      </Card>
      {selected && <Card title={selected.name || 'Ficha del lead'} actions={<Button onClick={() => setSelected(null)} disabled={busy}>Cerrar ficha</Button>}>
        <dl className="grid gap-3 sm:grid-cols-2">
          {Object.entries(selected.collected ?? {}).map(([key, value]) => <div key={key} className="min-w-0">
            <dt className="text-ink-3">{key.replace(/_/g, ' ')}</dt>
            <dd className="break-words text-ink">{String(value) || '—'}</dd>
          </div>)}
        </dl>
        {selected.notes && <p className="mt-4 whitespace-pre-wrap break-words">{selected.notes}</p>}
        <div className="mt-4">
          <Field label="Etapa" hint="Texto libre. Si querés que el agente la actualice, definí en el prompt cuándo guardar el dato etapa y qué valores usar.">
            <Input value={stage} onChange={(e) => setStage(e.target.value)} disabled={busy} />
          </Field>
          <Button className="mt-3" variant="primary" icon={Save} onClick={guardarEtapa} disabled={busy}>{busy ? 'Guardando…' : 'Guardar etapa'}</Button>
        </div>
      </Card>}
    </div>
  </>
}
