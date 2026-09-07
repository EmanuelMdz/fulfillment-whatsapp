import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, PlugZap, Power, RefreshCw, Save } from 'lucide-react'
import { api } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'
import { Badge, Button, CampoClave, Card, Checkbox, Field, Notice, PageHeader, Input, Textarea, WhatsappIcon } from '../ui'

/**
 * Conectar el número: la pantalla que convierte el sistema en TU bot.
 *
 * A la izquierda, el puente (WAHA): su dirección y su clave se cargan
 * acá, no en un archivo. A la derecha, la sesión: el flujo es el mismo
 * que vincular WhatsApp Web — arrancar, escanear el QR desde el
 * teléfono, listo. El QR vence cada un rato, así que se refresca solo
 * mientras la sesión lo esté pidiendo.
 */

const ESTADOS = {
  SIN_CONFIGURAR: { texto: 'Cargá la URL y la clave del puente para empezar.', tono: 'neutral' },
  SIN_SESION: { texto: 'El puente responde pero la sesión no existe todavía. Arrancala.', tono: 'neutral' },
  STARTING: { texto: 'La sesión está arrancando…', tono: 'yellow' },
  SCAN_QR_CODE: { texto: 'Escaneá el código con el teléfono del negocio.', tono: 'yellow' },
  WORKING: { texto: 'Conectado. El bot está atendiendo este número.', tono: 'green' },
  FAILED: { texto: 'La sesión falló. Probá reiniciarla.', tono: 'red' },
  STOPPED: { texto: 'La sesión está detenida. Arrancala.', tono: 'neutral' },
}

export default function Conexion() {
  const [estado, setEstado] = useState(null)
  const [qr, setQr] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState(null)
  const [claves, setClaves] = useState(null)
  const [form, setForm] = useState({ whatsapp_api_url: '', whatsapp_session: 'default', public_url: '' })
  const [modoPrueba, setModoPrueba] = useState({ activo: false, numeros: '' })
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
      .select('whatsapp_api_url, whatsapp_session, public_url, test_mode, test_numbers')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            whatsapp_api_url: data.whatsapp_api_url ?? '',
            whatsapp_session: data.whatsapp_session || 'default',
            public_url: data.public_url ?? '',
          })
          setModoPrueba({
            activo: Boolean(data.test_mode),
            numeros: (data.test_numbers ?? []).join('\n'),
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

  async function guardarModoPrueba(activo, numeros) {
    setGuardando(true)
    try {
      await api('/settings', { test_mode: activo, test_numbers: numeros })
      setModoPrueba({ activo, numeros })
      avisar(activo ? 'Modo prueba activo: el bot solo le contesta a esos números.' : 'Modo prueba apagado: el bot le contesta a todos.')
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

  const info = estado ? (ESTADOS[estado.status] ?? { texto: `Estado: ${estado.status}`, tono: 'neutral' }) : null
  const conectado = estado?.status === 'WORKING'

  return (
    <>
      <PageHeader
        title="Conexión"
        subtitle="Vinculá el número de WhatsApp del negocio."
        actions={info && <Badge tone={info.tono}>{estado.status === 'WORKING' ? 'Conectado' : estado.status.replace(/_/g, ' ').toLowerCase()}</Badge>}
      />
      {aviso && (
        <Notice tone={aviso.esError ? 'error' : 'ok'} className="mb-4">
          {aviso.texto}
        </Notice>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Puente de WhatsApp (WAHA)"
          subtitle="El servicio aparte que maneja la sesión de WhatsApp Web. Cómo levantarlo está en docs/DEPLOY.md."
        >
          <div className="grid gap-4">
            <Field label="URL del puente">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-0 flex-1"
                  value={form.whatsapp_api_url}
                  onChange={(e) => setForm({ ...form, whatsapp_api_url: e.target.value })}
                  placeholder="https://tu-waha.up.railway.app"
                />
                <Button variant="primary" icon={Save} onClick={guardarPuente} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </Field>
            <CampoClave
              etiqueta="Clave del puente"
              ayuda="La que le pusiste al desplegarlo (WHATSAPP_API_KEY)."
              estado={claves?.whatsapp_api_key}
              onGuardar={guardarClave}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={PlugZap} onClick={probar}>
                Probar conexión
              </Button>
              {prueba && (
                <span
                  className={
                    prueba.ok === true ? 'text-[13px] text-brand-2' : prueba.ok === false ? 'text-[13px] text-danger' : 'text-[13px] text-ink-3'
                  }
                >
                  {prueba.texto}
                </span>
              )}
            </div>

            <details className="rounded-ctl border border-line px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-medium text-ink-2">Avanzado</summary>
              <div className="mt-4 grid gap-4">
                <Field
                  label="Nombre de la sesión en el puente"
                  hint='Dejá "default" salvo que un mismo puente atienda varios negocios.'
                >
                  <Input
                    value={form.whatsapp_session}
                    onChange={(e) => setForm({ ...form, whatsapp_session: e.target.value })}
                  />
                </Field>
                <Field
                  label="URL pública de este panel"
                  hint={
                    estado?.public_url
                      ? `Detectada: ${estado.public_url}`
                      : 'No se detectó sola: completala para que los avisos al grupo lleven link.'
                  }
                >
                  <Input
                    value={form.public_url}
                    onChange={(e) => setForm({ ...form, public_url: e.target.value })}
                    placeholder="https://tu-bot.up.railway.app"
                  />
                </Field>
                {estado?.webhook && (
                  <p className="text-[12.5px] text-ink-3">
                    El puente le avisa a este servidor en{' '}
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink-2">{estado.webhook}</code> (se configura
                    solo al arrancar la sesión).
                  </p>
                )}
                <div>
                  <Button icon={Save} onClick={guardarPuente} disabled={guardando}>
                    Guardar
                  </Button>
                </div>
              </div>
            </details>
          </div>
        </Card>

        <div className="grid content-start gap-5">
          <Card
            title="Modo prueba"
            subtitle="Mientras lo tengas prendido, el bot SOLO le contesta a los números de abajo."
            actions={modoPrueba.activo && <Badge tone="yellow">activo</Badge>}
          >
            <div className="grid gap-4">
              <p className="text-[13px] text-ink-2">
                Es para el rato en que el número del negocio ya está conectado pero el prompt y el catálogo todavía se
                están afinando. Lo que escriban los demás se guarda y se ve en Conversaciones, pero el bot no les
                responde. Apagalo cuando el negocio esté listo para atender.
              </p>
              <Field
                label="Números autorizados, uno por línea"
                hint="Como los escribís normalmente: 099 123 456 o +598 99 123 456. Da igual el formato."
              >
                <Textarea
                  className="min-h-24 font-mono text-[13px]"
                  value={modoPrueba.numeros}
                  onChange={(e) => setModoPrueba({ ...modoPrueba, numeros: e.target.value })}
                  placeholder="099 123 456"
                />
              </Field>
              <Checkbox
                label="Modo prueba prendido"
                checked={modoPrueba.activo}
                onChange={(e) => guardarModoPrueba(e.target.checked, modoPrueba.numeros)}
              />
              <div>
                <Button
                  icon={FlaskConical}
                  onClick={() => guardarModoPrueba(modoPrueba.activo, modoPrueba.numeros)}
                  disabled={guardando}
                >
                  {guardando ? 'Guardando…' : 'Guardar números'}
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <WhatsappIcon size={18} className="text-brand" />
                Sesión de WhatsApp
              </span>
            }
            subtitle="El número que atiende el bot"
          >
            {!estado && !error && <p className="text-[13.5px] text-ink-3">Consultando…</p>}
            {info && (
              <Notice tone={info.tono === 'green' ? 'ok' : info.tono === 'red' ? 'error' : info.tono === 'yellow' ? 'warn' : 'info'}>
                {info.texto}
              </Notice>
            )}
            {error && (
              <Notice tone="error" className="mt-3">
                {error}
              </Notice>
            )}

            {estado?.configured && !conectado && (
              <div className="mt-4">
                <Button
                  variant="primary"
                  icon={estado.status === 'FAILED' || estado.status === 'WORKING' ? RefreshCw : Power}
                  onClick={arrancar}
                  disabled={trabajando}
                >
                  {trabajando ? 'Un momento…' : 'Arrancar / reiniciar la sesión'}
                </Button>
              </div>
            )}

            {qr && (
              <div className="mt-5 flex flex-col items-center gap-3">
                <div className="relative">
                  <img
                    src={qr}
                    alt="Código QR para vincular WhatsApp"
                    className="h-60 w-60 rounded-xl border border-line bg-white"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  {/* El glifo tapa el centro del código a propósito: los QR
                      tienen corrección de errores de sobra y así se ve de
                      un vistazo con qué app hay que escanearlo. */}
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-white shadow-card">
                      <WhatsappIcon size={24} className="text-brand" />
                    </span>
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-3">El código se renueva solo. Si expira, esperá al siguiente.</p>
              </div>
            )}
          </Card>

          <Card title="Cómo se conecta">
            <ol className="grid list-decimal gap-2 pl-5 text-[13.5px] text-ink-2">
              <li>Usá un número DEDICADO al negocio — nunca el personal.</li>
              <li>Pegá la URL y la clave del puente, y tocá "Probar conexión".</li>
              <li>Tocá "Arrancar la sesión" y esperá el código QR.</li>
              <li>En el teléfono: WhatsApp → Dispositivos vinculados → Vincular dispositivo.</li>
              <li>Escaneá el código. Cuando diga "Conectado", mandale un mensaje de prueba desde otro teléfono.</li>
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}
