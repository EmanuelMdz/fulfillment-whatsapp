import { useState } from 'react'
import { Save } from 'lucide-react'
import Badge from './Badge.jsx'
import Button from './Button.jsx'
import { Field, Input } from './Field.jsx'

/**
 * Un campo para una clave secreta. Nunca muestra la guardada: solo que
 * está cargada y sus últimos caracteres, para reconocerla. Pegar una
 * nueva la reemplaza. `estado` viene de GET /api/panel/secrets.
 *
 * La clave entera no vuelve del servidor jamás: si alguien entra a un
 * panel abierto, no se lleva las claves.
 */
export default function CampoClave({ etiqueta, ayuda, estado, onGuardar }) {
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await onGuardar(valor.trim())
      setValor('')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Field
      label={
        <span className="inline-flex flex-wrap items-center gap-2">
          {etiqueta}
          {estado?.set ? <Badge tone="green">cargada {estado.hint}</Badge> : <Badge>sin cargar</Badge>}
        </span>
      }
      hint={ayuda}
    >
      <div className="flex flex-wrap gap-2">
        <Input
          type="password"
          className="min-w-0 flex-1"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={estado?.set ? 'Pegá una nueva para reemplazarla' : 'Pegá la clave'}
          autoComplete="off"
        />
        <Button variant="primary" icon={Save} onClick={guardar} disabled={guardando || !valor.trim()}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Field>
  )
}
