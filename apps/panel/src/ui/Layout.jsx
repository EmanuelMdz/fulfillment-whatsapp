import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import {
  Inbox,
  ContactRound,
  ChartNoAxesColumn,
  SlidersHorizontal,
  FlaskConical,
  QrCode,
  Settings,
  LogOut,
  Sparkles,
  Rocket,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import logo from '../assets/ainnovate-white.png'
import Avatar from './Avatar.jsx'
import Badge from './Badge.jsx'
import Button from './Button.jsx'
import Notice from './Notice.jsx'
import WhatsappIcon from './WhatsappIcon.jsx'

/**
 * El esqueleto del panel: barra lateral oscura con el logo y el menú,
 * y arriba del contenido una barra con el negocio, el estado de las dos
 * conexiones y el usuario. En el teléfono la barra lateral se vuelve una
 * barra superior con solo íconos.
 *
 * El menú se ARMA, no se escribe a mano en el JSX. Dos motivos:
 *
 * - Las palabras salen del diccionario del negocio (`app_config.labels`),
 *   así que "Pedidos" dice "Ventas" en una tienda y "Consultas" en una
 *   clínica sin tocar este archivo.
 * - Una entrada con `module` solo aparece si ese módulo está prendido en
 *   la tabla `modules`. Cuando un módulo trae pantalla propia, se agrega
 *   una línea acá con su clave y listo: apagarlo la saca del menú.
 */

const MENU = [
  // El espejo del WhatsApp del negocio: el glifo del canal dice más que
  // un globo de diálogo genérico.
  { to: '/', end: true, icon: WhatsappIcon, texto: () => 'Conversaciones' },
  { to: '/revision', icon: Inbox, texto: () => 'Revisión' },
  { to: '/leads', icon: ContactRound, texto: () => 'Leads' },
  { to: '/metricas', icon: ChartNoAxesColumn, texto: () => 'Métricas' },
]

const MENU_CONFIG = [
  { to: '/studio', icon: SlidersHorizontal, texto: () => 'Studio' },
  { to: '/test', icon: FlaskConical, texto: () => 'Probar el bot' },
  { to: '/conexion', icon: QrCode, texto: () => 'Conexión' },
  { to: '/ajustes', icon: Settings, texto: () => 'Ajustes' },
]

const REFRESCO_ESTADO_MS = 30000

function ItemMenu({ to, end, icon: Icono, children }) {
  return (
    <NavLink
      title={children}
      aria-label={children}
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors',
          isActive ? 'bg-side-2 text-white' : 'text-side-ink hover:bg-side-2/60 hover:text-white',
        )
      }
    >
      <Icono size={17} className="shrink-0" />
      <span className="hidden md:inline">{children}</span>
    </NavLink>
  )
}

export default function Layout() {
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [labels, setLabels] = useState({})
  const [prendidos, setPrendidos] = useState(null) // null = todavía no sabemos
  const [estado, setEstado] = useState(null) // { whatsapp, llm }
  const [pendientes, setPendientes] = useState(0)
  const [usuario, setUsuario] = useState({ email: '', rol: '' })
  const [prueba, setPrueba] = useState(null) // { activo, numeros }

  const cargarModulos = useCallback(() => {
    supabase
      .from('modules')
      .select('key')
      .eq('enabled', true)
      .then(({ data }) => setPrendidos(new Set((data ?? []).map((m) => m.key))))
  }, [])

  useEffect(() => {
    supabase
      .from('app_config')
      .select('business_name, labels, test_mode, test_numbers')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        setNombreNegocio(data?.business_name || 'Panel')
        setLabels(data?.labels ?? {})
        setPrueba({ activo: Boolean(data?.test_mode), numeros: data?.test_numbers ?? [] })
      })
    cargarModulos()
    // Ajustes avisa cuando prende o apaga un módulo: la pestaña aparece
    // o desaparece sin recargar la página.
    window.addEventListener('fw:modules', cargarModulos)
    return () => window.removeEventListener('fw:modules', cargarModulos)
  }, [cargarModulos])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const email = data?.session?.user?.email ?? ''
      let rol = ''
      if (email) {
        const { data: fila } = await supabase.from('team_members').select('role').eq('email', email.toLowerCase()).maybeSingle()
        rol = fila?.role === 'owner' ? 'Dueño' : 'Equipo'
      }
      setUsuario({ email, rol })
    })
  }, [])

  useEffect(() => {
    async function revisar() {
      try {
        const h = await fetch('/health').then((r) => r.json())
        setEstado({ whatsapp: h.whatsapp, llm: h.llm, session: h.session })
      } catch {
        // El servidor no contesta: no hay nada útil que mostrar acá.
      }
      try {
        const st = await fetch('/api/install/status').then((r) => r.json())
        setPendientes(st.pending?.length ?? 0)
      } catch {
        // ídem
      }
    }
    revisar()
    const t = setInterval(revisar, REFRESCO_ESTADO_MS)
    return () => clearInterval(t)
  }, [])

  // Mientras no sepamos qué módulos están prendidos, mostramos solo el
  // núcleo: es preferible que una pestaña aparezca un instante después a
  // que parpadee y desaparezca.
  const visible = (entrada) => !entrada.module || Boolean(prendidos?.has(entrada.module))

  const configurado = estado?.whatsapp === 'configurado'
  const iaOk = estado?.llm === 'configurado'
  // 'WORKING' es el único estado en que el bot está atendiendo de verdad.
  // Lo escribe el vigilante del servidor (workers/session-watch.ts).
  const conectado = configurado && estado?.session === 'WORKING'
  // Un número caído es lo más grave que puede pasar y el negocio no se
  // entera solo: el aviso al grupo sale por ese mismo WhatsApp.
  const caido = configurado && Boolean(estado?.session) && estado.session !== 'WORKING'

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* ── Barra lateral (escritorio) / barra superior (teléfono) ── */}
      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto bg-side px-3 py-2 md:sticky md:top-0 md:h-screen md:w-[240px] md:flex-col md:items-stretch md:overflow-visible md:px-4 md:py-6">
        <div className="mr-2 shrink-0 md:mr-0 md:mb-8 md:px-1">
          <img src={logo} alt="Ainnovate" className="h-8 w-auto md:h-12" />
        </div>

        <div className="flex gap-1 md:flex-col">
          {MENU.filter(visible).map(({ to, end, icon, texto }) => (
            <ItemMenu key={to} to={to} end={end} icon={icon}>
              {texto(labels)}
            </ItemMenu>
          ))}
        </div>

        <div className="mx-1 h-6 w-px shrink-0 bg-side-line md:mx-2 md:my-4 md:h-px md:w-auto" />

        <div className="flex gap-1 md:flex-col">
          {MENU_CONFIG.filter(visible).map(({ to, end, icon, texto }) => (
            <ItemMenu key={to} to={to} end={end} icon={icon}>
              {texto(labels)}
            </ItemMenu>
          ))}
        </div>

        <div className="md:flex-1" />

        {/* Abajo de todo: la guía de instalación. No es una pantalla de
            operación diaria — se usa mientras se instala, con el panel
            abierto al lado. */}
        <div className="flex gap-1 md:mb-1 md:flex-col">
          <ItemMenu to="/puesta-en-marcha" icon={Rocket}>
            Puesta en marcha
          </ItemMenu>
        </div>

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-side-ink transition-colors hover:bg-side-2/60 hover:text-white"
        >
          <LogOut size={17} />
          <span className="hidden md:inline">Salir</span>
        </button>
      </nav>

      {/* ── Contenido ── */}
      <main className="min-w-0 flex-1 px-4 py-4 md:px-8 md:py-6">
        <div className="mx-auto max-w-[1400px]">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold text-ink">{nombreNegocio || 'Panel'}</p>
              <p className="text-[12px] text-ink-3">Panel de atención</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {estado && (
                <NavLink to="/conexion">
                  <Badge tone={conectado ? 'green' : caido ? 'red' : 'yellow'} icon={WhatsappIcon}>
                    {conectado ? 'WhatsApp conectado' : caido ? 'WhatsApp desconectado' : 'WhatsApp sin configurar'}
                  </Badge>
                </NavLink>
              )}
              {estado && (
                <NavLink to="/studio">
                  <Badge tone={iaOk ? 'green' : 'yellow'} icon={Sparkles}>
                    {iaOk ? 'IA lista' : 'IA sin clave'}
                  </Badge>
                </NavLink>
              )}
              {usuario.email && (
                <div className="flex items-center gap-2.5 md:ml-2">
                  <Avatar email={usuario.email} />
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-[13px] font-semibold text-ink">{usuario.email}</p>
                    <p className="text-[11.5px] text-ink-3">{usuario.rol}</p>
                  </div>
                </div>
              )}
            </div>
          </header>

          {prueba?.activo && (
            <Notice
              tone="warn"
              className="mb-5"
              action={
                <Button size="sm" to="/conexion">
                  Ver
                </Button>
              }
            >
              <strong>Modo prueba activo.</strong> El bot solo le contesta a{' '}
              {prueba.numeros.length ? prueba.numeros.join(', ') : '(ningún número: no le contesta a nadie)'}. Al resto
              le guarda los mensajes sin responder.
            </Notice>
          )}

          {caido && (
            <Notice
              tone="error"
              className="mb-5"
              action={
                <Button size="sm" to="/conexion">
                  Reconectar
                </Button>
              }
            >
              <strong>El número está desconectado: el bot no puede contestar.</strong> Los mensajes que lleguen se
              guardan, pero nadie los responde hasta que vuelvas a escanear el código.
            </Notice>
          )}

          {pendientes > 0 && (
            <Notice
              tone="warn"
              className="mb-5"
              action={
                <Button size="sm" to="/instalar">
                  Aplicar
                </Button>
              }
            >
              Hay cambios pendientes en la base de datos.
            </Notice>
          )}

          <Outlet />
        </div>
      </main>
    </div>
  )
}
