import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Check, RotateCcw } from 'lucide-react'
import { Badge, Button, Card, PageHeader } from '../ui'

/**
 * Puesta en marcha: el mapa de qué hacer para instalar el sistema,
 * conectarlo a un WhatsApp real y entregárselo a un cliente.
 *
 * Está adentro del panel y no solo en `docs/` a propósito: es una lista
 * que se sigue MIENTRAS se instala, con el panel abierto en la otra
 * pestaña. Por eso cada paso se puede tildar y el avance queda guardado
 * en el navegador — no en la base: es el progreso de la persona que
 * instala, no un dato del negocio, y dos personas instalando dos
 * clientes distintos no tienen por qué pisarse.
 */

const CLAVE = 'fw:puesta-en-marcha'

function Codigo({ children }) {
  return (
    <pre className="mt-2.5 overflow-x-auto rounded-xl bg-side px-3.5 py-3 font-mono text-[12.5px] leading-[1.6] text-side-ink">
      {children}
    </pre>
  )
}

function Aviso({ children }) {
  return (
    <div className="mt-2.5 flex items-start gap-2.5 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

const FASES = [
  {
    n: 1,
    titulo: 'La base y el servidor',
    tiempo: '15 min',
    bajada: 'Dos cuentas, dos variables. Al final de esta fase el panel abre y ya tenés usuario.',
    pasos: [
      {
        id: 'supabase',
        titulo: 'Crear el proyecto',
        donde: 'Supabase',
        cuerpo: (
          <>
            <p>
              New project, región cercana. En <b>Settings → API</b> copiás la <b>Project URL</b>.
            </p>
            <p>
              Arriba a la derecha, tu avatar → <b>Account → Access Tokens → Generate new token</b>. Empieza con{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">sbp_</code> y se muestra{' '}
              <b>una sola vez</b>.
            </p>
          </>
        ),
      },
      {
        id: 'railway-bot',
        titulo: 'Desplegar el bot',
        donde: 'Railway',
        cuerpo: (
          <>
            <p>New Project → Deploy from GitHub repo → tu fork. En Variables → Raw Editor, pegás:</p>
            <Codigo>{`SUPABASE_URL=https://TU_PROYECTO.supabase.co\nSUPABASE_ACCESS_TOKEN=sbp_...`}</Codigo>
            <p className="mt-2.5">
              Después <b>Settings → Networking → Generate Domain</b>. Esa es la URL de todo: panel, API y webhook.
            </p>
            <Aviso>
              <b>No cargues PORT en Railway.</b> La inyecta sola y pisarla rompe el despliegue.
            </Aviso>
          </>
        ),
      },
      {
        id: 'asistente',
        titulo: 'Abrir la URL y completar el asistente',
        donde: 'El panel',
        cuerpo: (
          <p>
            Las tablas ya se crearon solas al arrancar. El asistente te pide el <b>pack</b>, el nombre del negocio, tu
            usuario, y los últimos 8 caracteres del token para confirmar que sos vos.
          </p>
        ),
      },
    ],
  },
  {
    n: 2,
    titulo: 'Conectar el número',
    tiempo: '10 min',
    bajada: 'El puente, el modo prueba y el QR. El orden importa: el modo prueba va antes de escanear.',
    pasos: [
      {
        id: 'waha',
        titulo: 'Levantar el puente',
        donde: 'Railway',
        cuerpo: (
          <>
            <p>
              En el <b>mismo proyecto</b>: + New → Docker Image →{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">devlikeapro/waha</code>.
              Variables:
            </p>
            <Codigo>{`WHATSAPP_API_KEY=inventá-una-clave-larga\nWAHA_DASHBOARD_USERNAME=admin\nWAHA_DASHBOARD_PASSWORD=inventá-otra\nWHATSAPP_DEFAULT_ENGINE=WEBJS`}</Codigo>
            <p className="mt-2.5">
              Generate Domain, puerto <b>3000</b>.
            </p>
            <Aviso>
              <b>Settings → Volumes → /app/.sessions.</b> Sin el volumen, cada redeploy del puente te pide escanear el
              QR de nuevo. Es lo que más se olvida.
            </Aviso>
          </>
        ),
      },
      {
        id: 'modo-prueba',
        titulo: 'Verificar el modo prueba y cargar tu número',
        donde: 'Panel · Conexión',
        cuerpo: (
          <>
            <p>
              Cargás <b>tu número</b> (como lo escribas: 099 123 456) y lo prendés. Desde ahí el bot{' '}
              <b>solo te contesta a vos</b>: lo que escriba cualquier otro se guarda y se ve en el panel, pero el bot
              se queda callado.
            </p>
            <p>La instalación empieza en modo prueba. Verificá el filtro con otro teléfono antes de habilitar clientes.</p>
          </>
        ),
      },
      {
        id: 'qr',
        titulo: 'Escanear el QR',
        donde: 'Panel · Conexión',
        cuerpo: (
          <>
            <p>
              Pegás la URL del puente y la clave → <b>Probar conexión</b> → <b>Arrancar la sesión</b>.
            </p>
            <p>
              En el teléfono del negocio: WhatsApp → <b>Dispositivos vinculados</b> → Vincular dispositivo. La pastilla
              de arriba pasa a <b>WhatsApp conectado</b> en verde.
            </p>
            <Aviso>
              <b>Un chip dedicado, nunca el personal.</b> El puente es no oficial: hay riesgo de bloqueo. Si pasa, se
              pierde ese número y nada más.
            </Aviso>
          </>
        ),
      },
    ],
  },
  {
    n: 3,
    titulo: 'Enseñarle al bot',
    tiempo: '30 min',
    bajada: 'Acá está el trabajo de verdad, y es lo que separa un bot que vende de uno que molesta.',
    pasos: [
      {
        id: 'prompt',
        titulo: 'Que Claude escriba el prompt',
        donde: 'Tu Claude',
        cuerpo: (
          <>
            <p>
              Le decís <em>"escribime el prompt de mi cliente"</em> y le contás el negocio. Te pregunta lo que falta,
              escribe <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">prompts/negocio.md</code>{' '}
              y lo sube con{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">npm run prompt:push</code>.
            </p>
            <p>Aparece solo en Studio. Lo leés, lo retocás si querés, y listo.</p>
          </>
        ),
      },
      {
        id: 'catalogo',
        titulo: 'Cargar el catálogo con sus fichas',
        donde: 'Panel · Catálogo',
        cuerpo: (
          <>
            <p>
              Una ficha por cosa, en el campo <b>"Lo que la IA sabe"</b>: las tres preguntas típicas con su respuesta,
              cómo elegir entre variantes, y qué <b>no</b> hay.
            </p>
            <p>
              El catálogo mueve más la calidad de las respuestas que cualquier prompt. Un bot que contesta mal casi
              siempre tiene fichas vacías.
            </p>
          </>
        ),
      },
      {
        id: 'simulador',
        titulo: 'Probar sin gastar el número',
        donde: 'Panel · Probar el bot',
        cuerpo: (
          <>
            <p>
              Diez preguntas, incluidas <b>dos que no tiene que saber contestar</b>: la respuesta correcta ahí es "no
              lo sé, lo averiguo" o derivar.
            </p>
            <p>
              <b>"Lo que lee la IA"</b> te muestra el prompt completo, tal como lo recibe el modelo. Cuando algo sale
              raro, ahí se ve por qué.
            </p>
          </>
        ),
      },
    ],
  },
  {
    n: 4,
    titulo: 'Probar y entregar',
    tiempo: '20 min',
    bajada: 'Trece pruebas con dos teléfonos. Recién ahí se apaga el modo prueba.',
    pasos: [
      {
        id: 'pruebas',
        titulo: 'Las trece pruebas',
        donde: 'Dos teléfonos',
        cuerpo: (
          <>
            <p>
              Las fáciles: llega el mensaje, el bot contesta. Las que importan: que <b>no conteste tres veces</b> a
              tres mensajes seguidos, que no confunda su propio eco, que responder desde el celular del negocio lo
              calle, que devolver al bot <b>no rebote</b>, que el grupo reciba <b>un</b> aviso, que el bot no le
              conteste al grupo, y que la caída avise.
            </p>
            <p>
              Están una por una en{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">docs/PRUEBAS.md</code>, con el
              resultado esperado y dónde mirar si falla.
            </p>
          </>
        ),
      },
      {
        id: 'apagar-prueba',
        titulo: 'Apagar el modo prueba',
        donde: 'Panel · Conexión',
        cuerpo: (
          <p>
            Es el olvido más caro de todos: el bot queda ignorando a los clientes reales, en silencio. El panel lo
            avisa en amarillo mientras está prendido.
          </p>
        ),
      },
      {
        id: 'entregar',
        titulo: 'Entregar',
        donde: 'Panel · Ajustes',
        cuerpo: (
          <>
            <p>
              Creás el usuario del cliente, borrás el catálogo de ejemplo, y le explicás tres cosas: que puede
              responder desde el panel o desde el celular y el bot se calla, que "Devolver al bot" lo destraba, y que
              si el panel se pone rojo hay que reconectar el número.
            </p>
            <p>
              Y le decís cuánto sale por mes: <b>entre diez y quince dólares</b>, y quién lo paga.
            </p>
          </>
        ),
      },
    ],
  },
]

const ERRORES = [
  {
    titulo: 'El puente sin volumen',
    texto: 'Cada redeploy pide el QR de nuevo, y el bot queda mudo hasta que alguien lo escanee.',
    fix: 'Volumen en /app/.sessions',
  },
  {
    titulo: 'El modo prueba prendido',
    texto: 'El bot ignora a todos los clientes reales y nadie se entera, porque no falla: se calla.',
    fix: 'Apagarlo antes de entregar',
  },
  {
    titulo: 'Sin grupo de avisos',
    texto: 'Un pedido esperando confirmación que nadie ve es una venta perdida y un cliente enojado.',
    fix: 'Studio · Grupo de avisos',
  },
  {
    titulo: 'Acelerar la cola',
    texto: 'Bajar las pausas para "que conteste más rápido" es la forma más segura de que bloqueen el número.',
    fix: 'Dejar las pausas de fábrica',
  },
]

const TOTAL_PASOS = FASES.reduce((n, f) => n + f.pasos.length, 0)

/**
 * Las cuatro piezas y cómo se hablan. Es lo que un alumno no puede armar
 * leyendo pasos sueltos: las dos flechas verdes son las que se configuran
 * a mano, y son las que más confunden — el bot tiene que saber dónde está
 * el puente, y el puente tiene que saber dónde está el bot.
 */
function Diagrama() {
  return (
    <svg
      viewBox="0 0 1000 400"
      role="img"
      aria-label="El servidor del bot lee y escribe en Supabase, sirve el panel en el mismo origen, le manda mensajes al puente WAHA y recibe de vuelta el aviso por webhook; WAHA sostiene la sesión de WhatsApp vinculada por QR con el teléfono del negocio."
      className="w-full text-ink-2"
      style={{ height: 'auto' }}
    >
      <defs>
        <marker id="pmFlecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
        <marker id="pmFlechaV" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-brand-2)" />
        </marker>
      </defs>

      <rect x="320" y="24" width="270" height="62" rx="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x="455" y="49" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">El panel</text>
      <text x="455" y="70" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">lo que ve el negocio en el navegador</text>
      <line x1="455" y1="86" x2="455" y2="160" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#pmFlecha)" />
      <text x="467" y="128" fontSize="13" fill="currentColor" opacity=".7">mismo origen: un solo deploy</text>

      <rect x="24" y="162" width="180" height="96" rx="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="114" y="197" textAnchor="middle" fontSize="17" fontWeight="700" fill="currentColor">Supabase</text>
      <text x="114" y="219" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">la base y el login</text>
      <text x="114" y="238" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">gratis para empezar</text>

      <rect x="320" y="162" width="270" height="96" rx="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <text x="455" y="197" textAnchor="middle" fontSize="17" fontWeight="700" fill="currentColor">Servidor del bot</text>
      <text x="455" y="219" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">Railway · siempre encendido</text>
      <text x="455" y="238" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">cola de envío, turnos, crons</text>

      <rect x="700" y="162" width="160" height="96" rx="14" fill="none" stroke="var(--color-brand-2)" strokeWidth="2.5" />
      <text x="780" y="197" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--color-brand-2)">WAHA</text>
      <text x="780" y="219" textAnchor="middle" fontSize="13" fill="var(--color-brand-2)" opacity=".85">el puente</text>
      <text x="780" y="238" textAnchor="middle" fontSize="13" fill="var(--color-brand-2)" opacity=".85">Railway · con volumen</text>

      <line x1="204" y1="210" x2="316" y2="210" stroke="currentColor" strokeWidth="1.5" markerStart="url(#pmFlecha)" markerEnd="url(#pmFlecha)" />
      <text x="260" y="200" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">config, chats,</text>
      <text x="260" y="234" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">pedidos</text>

      <path d="M590 192 L696 192" fill="none" stroke="var(--color-brand-2)" strokeWidth="2" markerEnd="url(#pmFlechaV)" />
      <text x="643" y="182" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-brand-2)">manda el mensaje</text>

      <path d="M696 236 L594 236" fill="none" stroke="var(--color-brand-2)" strokeWidth="2" markerEnd="url(#pmFlechaV)" />
      <text x="643" y="256" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-brand-2)">webhook: llegó uno</text>

      <line x1="780" y1="258" x2="780" y2="312" stroke="currentColor" strokeWidth="1.5" markerStart="url(#pmFlecha)" markerEnd="url(#pmFlecha)" />
      <text x="794" y="290" fontSize="13" fill="currentColor" opacity=".7">sesión por QR</text>

      <rect x="690" y="314" width="180" height="62" rx="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="780" y="339" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">El número</text>
      <text x="780" y="360" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">un chip dedicado</text>

      <line x1="686" y1="345" x2="594" y2="345" stroke="currentColor" strokeWidth="1.5" markerStart="url(#pmFlecha)" markerEnd="url(#pmFlecha)" />
      <rect x="404" y="314" width="186" height="62" rx="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x="497" y="339" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">El cliente</text>
      <text x="497" y="360" textAnchor="middle" fontSize="13" fill="currentColor" opacity=".7">escribe por WhatsApp</text>
    </svg>
  )
}

export default function PuestaEnMarcha() {
  const [hechos, setHechos] = useState({})

  // El avance vive en el navegador de quien instala, no en la base: es su
  // progreso, no un dato del negocio. Si el almacenamiento no está
  // disponible (ventana privada), la página funciona igual sin tildes.
  useEffect(() => {
    try {
      setHechos(JSON.parse(localStorage.getItem(CLAVE) ?? '{}'))
    } catch {
      setHechos({})
    }
  }, [])

  function alternar(id) {
    setHechos((previos) => {
      const nuevos = { ...previos, [id]: !previos[id] }
      try {
        localStorage.setItem(CLAVE, JSON.stringify(nuevos))
      } catch {
        // Sin almacenamiento, el tilde vale solo mientras dure la página.
      }
      return nuevos
    })
  }

  function reiniciar() {
    setHechos({})
    try {
      localStorage.removeItem(CLAVE)
    } catch {
      // ídem
    }
  }

  const listos = Object.values(hechos).filter(Boolean).length
  const completo = listos === TOTAL_PASOS

  return (
    <>
      <PageHeader
        title="Puesta en marcha"
        subtitle="Qué hay que hacer para instalar el sistema, conectarlo a un WhatsApp real y entregárselo a un cliente."
        actions={
          <>
            <Badge tone={completo ? 'green' : 'neutral'}>
              {listos} de {TOTAL_PASOS} pasos
            </Badge>
            {listos > 0 && (
              <Button size="sm" icon={RotateCcw} onClick={reiniciar}>
                Empezar de nuevo
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5">
        <Card
          title="Cómo se conectan las piezas"
          subtitle="Las dos flechas verdes son las que se configuran a mano, y las que más confunden: el bot tiene que saber dónde está el puente (URL y clave), y el puente tiene que saber dónde está el bot (el webhook, que el panel deja apuntado solo al arrancar la sesión)."
        >
          <Diagrama />
        </Card>

        {FASES.map((fase) => {
          const deLaFase = fase.pasos.filter((p) => hechos[p.id]).length
          const faseLista = deLaFase === fase.pasos.length
          return (
            <Card
              key={fase.n}
              title={
                <span className="flex items-center gap-2.5">
                  <span
                    className={clsx(
                      'grid h-7 w-7 place-items-center rounded-lg text-[13px] font-extrabold',
                      faseLista ? 'bg-brand text-white' : 'bg-side text-white',
                    )}
                  >
                    {faseLista ? <Check size={15} /> : fase.n}
                  </span>
                  {fase.titulo}
                </span>
              }
              subtitle={fase.bajada}
              actions={
                <Badge tone={faseLista ? 'green' : 'neutral'}>
                  {faseLista ? 'lista' : fase.tiempo}
                </Badge>
              }
            >
              <ul className="grid gap-2.5">
                {fase.pasos.map((paso) => {
                  const hecho = Boolean(hechos[paso.id])
                  return (
                    <li
                      key={paso.id}
                      className={clsx(
                        'rounded-xl border p-4 transition-colors',
                        hecho ? 'border-brand/40 bg-brand-soft/40' : 'border-line bg-surface',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id={`paso-${paso.id}`}
                          checked={hecho}
                          onChange={() => alternar(paso.id)}
                          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand"
                        />
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={`paso-${paso.id}`}
                            className="flex cursor-pointer flex-wrap items-center gap-2 text-[15px] font-bold text-ink"
                          >
                            {paso.titulo}
                            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-ink-3 uppercase">
                              {paso.donde}
                            </span>
                          </label>
                          <div className="mt-1.5 grid gap-1.5 text-[13.5px] text-ink-2 [&_b]:text-ink">
                            {paso.cuerpo}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}

        <section className="rounded-card bg-side p-6 text-side-ink">
          <h2 className="text-[19px] font-extrabold text-white">Los cuatro errores que cuestan caro</h2>
          <p className="mt-1 mb-5 text-[13.5px]">
            Cada uno salió de un problema real. Los cuatro son silenciosos: nada se rompe, simplemente deja de
            funcionar.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ERRORES.map((e) => (
              <div key={e.titulo} className="rounded-xl bg-white/5 p-4">
                <h3 className="text-[14px] font-bold text-white">{e.titulo}</h3>
                <p className="mt-1 text-[13px]">{e.texto}</p>
                <span className="mt-2 block text-[13px] font-semibold text-brand">{e.fix}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
