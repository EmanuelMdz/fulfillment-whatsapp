import { useCallback, useEffect, useState } from 'react'
import { Power, RefreshCw } from 'lucide-react'
import { api } from '../lib/api.js'

/**
 * Conectar el número: la pantalla que convierte el sistema en TU bot.
 *
 * El flujo es el mismo que vincular WhatsApp Web: arrancar la sesión,
 * escanear el QR desde el teléfono, listo. El QR vence cada un rato, así
 * que se refresca solo mientras la sesión lo esté pidiendo.
 */

const ESTADOS = {
  SIN_CONFIGURAR: { texto: 'Falta configurar el puente de WhatsApp (WHATSAPP_API_URL y WHATSAPP_API_KEY en el .env).', tono: 'error' },
  SIN_SESION: { texto: 'El puente responde pero la sesión no existe todavía. Arrancala.', tono: 'muted' },
  STARTING: { texto: 'La sesión está arrancando…', tono: 'muted' },
  SCAN_QR_CODE: { texto: 'Escaneá el código con el teléfono del negocio.', tono: 'muted' },
  WORKING: { texto: 'Conectado. El bot está atendiendo este número.', tono: 'ok' },
  FAILED: { texto: 'La sesión falló. Probá reiniciarla.', tono: 'error' },
  STOPPED: { texto: 'La sesión está detenida. Arrancala.', tono: 'muted' },
}

export default function Conexion() {
  const [estado, setEstado] = useState(null)
  const [qr, setQr] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState(null)

  const consultar = useCallback(async () => {
    try {
      const s = await api('/session')
      setEstado(s)
      if (s.status === 'SCAN_QR_CODE') {
        const r = await api('/session/qr')
        setQr(r.qr ?? null)
      } else {
        setQr(null)
      }
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    consultar()
    const t = setInterval(consultar, 5000)
    return () => clearInterval(t)
  }, [consultar])

  async function arrancar() {
    setTrabajando(true)
    setError(null)
    try {
      await api('/session/start', {})
      await consultar()
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(false)
    }
  }

  const info = estado ? (ESTADOS[estado.status] ?? { texto: `Estado: ${estado.status}`, tono: 'muted' }) : null
  const conectado = estado?.status === 'WORKING'

  return (
    <>
      <h1 className="page-title">Conexión</h1>
      <p className="page-sub">Vinculá el número de WhatsApp del negocio.</p>

      <div className="card">
        <h2>Estado</h2>
        {!estado && !error && <p className="muted">Consultando…</p>}
        {info && (
          <p className={info.tono === 'error' ? 'error-text' : info.tono === 'ok' ? 'ok-text' : 'muted'}>
            {info.texto}
          </p>
        )}
        {error && <p className="error-text">{error}</p>}

        {estado?.configured && !conectado && (
          <button className="btn primary" onClick={arrancar} disabled={trabajando}>
            {estado.status === 'FAILED' || estado.status === 'WORKING' ? <RefreshCw size={15} /> : <Power size={15} />}
            {trabajando ? 'Un momento…' : 'Arrancar / reiniciar la sesión'}
          </button>
        )}

        {qr && (
          <div className="qr-box">
            <img src={qr} alt="Código QR para vincular WhatsApp" />
            <p className="muted">El código se renueva solo. Si expira, esperá al siguiente.</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Cómo se conecta</h2>
        <ol className="steps">
          <li>Usá un número DEDICADO al negocio — nunca el personal.</li>
          <li>Tocá "Arrancar la sesión" y esperá el código QR.</li>
          <li>En el teléfono: WhatsApp → Dispositivos vinculados → Vincular dispositivo.</li>
          <li>Escaneá el código. Cuando diga "Conectado", mandale un mensaje de prueba desde otro teléfono.</li>
        </ol>
      </div>
    </>
  )
}
