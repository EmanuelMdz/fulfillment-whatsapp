import { useState } from 'react'
import { Save } from 'lucide-react'

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
    <label className="field">
      <span>
        {etiqueta}{' '}
        {estado?.set ? (
          <span className="chip ok">cargada {estado.hint}</span>
        ) : (
          <span className="chip">sin cargar</span>
        )}
        {ayuda ? <span className="muted"> — {ayuda}</span> : null}
      </span>
      <div className="clave-row">
        <input
          type="password"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={estado?.set ? 'Pegá una nueva para reemplazarla' : 'Pegá la clave'}
          autoComplete="off"
        />
        <button className="btn primary" onClick={guardar} disabled={guardando || !valor.trim()}>
          <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </label>
  )
}
