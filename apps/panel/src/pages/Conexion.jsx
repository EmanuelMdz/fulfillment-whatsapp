import { useCallback, useEffect, useState } from 'react'
import { PlugZap, Power, RefreshCw, Save } from 'lucide-react'
import { api } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'
import CampoClave from '../ui/CampoClave.jsx'

/**
 * Conectar el número: la pantalla que convierte el sistema en TU bot.
 *
 * Arriba, el puente (WAHA): su dirección y su clave se cargan acá, no en
 * un archivo. Abajo, la sesión: el flujo es el mismo que vincular
 * WhatsApp Web — arrancar, escanear el QR desde el teléfono, listo. El
 * QR vence cada un rato, así que se refresca solo mientras la sesión lo
 * esté pidiendo.
 */

const ESTADOS = {
  SIN_CONFIGURAR: { texto: 'Cargá la URL y la clave del puente acá arriba para empezar.', tono: 'muted' },
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
  const [claves, setClaves] = useState(null)
  const [form, setForm] = useState({ whatsapp_api_url: '', whatsapp_session: 'default', public_url: '' })
  const [guardando, setGuardando] = useState(false)
  const [prueba, setPrueba] = useState(null)
  const [aviso, setAviso] = useState(null)

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

  useEffect(() => {
    api('/secrets').then(setClaves).catch(() => {})
    supabase
      .from('app_config')
      .select('whatsapp_api_url, whatsapp_session, public_url')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            whatsapp_api_url: data.whatsapp_api_url ?? '',
            whatsapp_session: data.whatsapp_session || 'default',
            public_url: data.public_url ?? '',
          })
        }
      })
  }, [])

  function avisar(texto, esError = false) {
    setAviso({ texto, esError })
    setTimeout(() => setAviso(null), 3500)
  }

  async function guardarPuente() {
    setGuardando(true)
    try {
      await api('/settings', {
        whatsapp_api_url: form.whatsapp_api_url,
        whatsapp_session: form.whatsapp_session || 'default',
        public_url: form.public_url,
      })
      avisar('Guardado.')
      setPrueba(null)
      await consultar()
    } catch (err) {
      avisar(err.message, true)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarClave(valor) {
    try {
      const r = await api('/secrets', { whatsapp_api_key: valor })
      setClaves(r.claves)
      avisar(valor ? 'Clave guardada.' : 'Clave borrada.')
      setPrueba(null)
      consultar()
    } catch (err) {
      avisar(err.message, true)
    }
  }

  async function probar() {
    setPrueba({ texto: 'Probando…' })
    try {
      const r = await api('/secrets/test', { que: 'whatsapp' })
      setPrueba(r.ok ? { ok: true, texto: 'El puente responde y la clave es correcta.' } : { ok: false, texto: r.error })
    } catch (err) {
      setPrueba({ ok: false, texto: err.message })
    }
  }

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
  const tono = (t) => (t === 'error' ? 'error-text' : t === 'ok' ? 'ok-text' : 'muted')

  return (
    <>
      <h1 className="page-title">Conexión</h1>
      <p className="page-sub">Vinculá el número de WhatsApp del negocio.</p>
      {aviso && <p className={aviso.esError ? 'error-text' : 'ok-text'}>{aviso.texto}</p>}

      <div className="card">
        <h2>Puente de WhatsApp (WAHA)</h2>
        <p className="muted">
          El puente es un servicio aparte que maneja la sesión de WhatsApp Web. Pegá su dirección
          y la clave que le pusiste al desplegarlo (WHATSAPP_API_KEY). Cómo levantarlo está en
          docs/DEPLOY.md.
        </p>
        <label className="field">
          <span>URL del puente</span>
          <input
            value={form.whatsapp_api_url}
            onChange={(e) => setForm({ ...form, whatsapp_api_url: e.target.value })}
            placeholder="https://tu-waha.up.railway.app"
          />
        </label>
        <button className="btn primary" onClick={guardarPuente} disabled={guardando}>
          <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar URL'}
        </button>
        <div style={{ height: 12 }} />
        <CampoClave
          etiqueta="Clave del puente"
          estado={claves?.whatsapp_api_key}
          onGuardar={guardarClave}
        />
        <div className="acciones-inline">
          <button className="btn" onClick={probar}>
            <PlugZap size={15} /> Probar conexión
          </button>
          {prueba && (
            <span className={prueba.ok === true ? 'ok-text' : prueba.ok === false ? 'error-text' : 'muted'}>
              {prueba.texto}
            </span>
          )}
        </div>

        <details className="avanzado">
          <summary>Avanzado</summary>
          <label className="field">
            <span>
              Nombre de la sesión en el puente. Dejá "default" salvo que un mismo puente atienda
              varios negocios.
            </span>
            <input
              value={form.whatsapp_session}
              onChange={(e) => setForm({ ...form, whatsapp_session: e.target.value })}
            />
          </label>
          <label className="field">
            <span>
              URL pública de este panel
              {estado?.public_url
                ? ` — detectada: ${estado.public_url}`
                : ' — no se detectó sola: completala para que los avisos al grupo lleven link'}
            </span>
            <input
              value={form.public_url}
              onChange={(e) => setForm({ ...form, public_url: e.target.value })}
              placeholder="https://tu-bot.up.railway.app"
            />
          </label>
          {estado?.webhook && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              El puente le avisa a este servidor en: <code>{estado.webhook}</code> (se configura solo
              al arrancar la sesión).
            </p>
          )}
          <button className="btn" onClick={guardarPuente} disabled={guardando}>
            <Save size={15} /> Guardar
          </button>
        </details>
      </div>

      <div className="card">
        <h2>Estado</h2>
        {!estado && !error && <p className="muted">Consultando…</p>}
        {info && <p className={tono(info.tono)}>{info.texto}</p>}
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
          <li>Pegá la URL y la clave del puente, y tocá "Probar conexión".</li>
          <li>Tocá "Arrancar la sesión" y esperá el código QR.</li>
          <li>En el teléfono: WhatsApp → Dispositivos vinculados → Vincular dispositivo.</li>
          <li>Escaneá el código. Cuando diga "Conectado", mandale un mensaje de prueba desde otro teléfono.</li>
        </ol>
      </div>
    </>
  )
}
