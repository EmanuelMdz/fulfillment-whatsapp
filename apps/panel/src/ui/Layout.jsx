import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  MessageSquare,
  Inbox,
  ClipboardList,
  Package,
  SlidersHorizontal,
  QrCode,
  FlaskConical,
  ChartNoAxesColumn,
  Settings,
  LogOut,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'

/**
 * El esqueleto del panel: barra lateral en escritorio, barra superior
 * con solo íconos en el teléfono.
 *
 * El menú se ARMA, no se escribe a mano en el JSX. Dos motivos:
 *
 * - Las palabras salen del diccionario del negocio (`app_config.labels`),
 *   así que "Pedidos" dice "Ventas" en una tienda y "Consultas" en una
 *   clínica sin tocar este archivo.
 * - Una entrada con `module` solo aparece si ese módulo está prendido en
 *   la tabla `modules`. Cuando un módulo trae pantalla propia, se agrega
 *   una línea acá con su clave y listo: apagarlo la saca del menú.
 *
 * Arriba del contenido va la franja de avisos: lo que falta configurar
 * para que el bot ande (WhatsApp, la clave de IA, migraciones nuevas).
 * Sale de /health y de /api/install/status, que no piden sesión.
 */

const MENU = [
  { to: '/', end: true, icon: MessageSquare, texto: () => 'Conversaciones' },
  { to: '/revision', icon: Inbox, texto: () => 'Revisión' },
  { to: '/pedidos', icon: ClipboardList, texto: (l) => l.order_plural ?? 'Pedidos' },
  { to: '/catalogo', icon: Package, texto: (l) => l.item_plural ?? 'Catálogo' },
  { to: '/metricas', icon: ChartNoAxesColumn, texto: () => 'Métricas' },
  { to: '/studio', icon: SlidersHorizontal, texto: () => 'Studio' },
  { to: '/test', icon: FlaskConical, texto: () => 'Probar el bot' },
  { to: '/conexion', icon: QrCode, texto: () => 'Conexión' },
  { to: '/ajustes', icon: Settings, texto: () => 'Ajustes' },
]

const REFRESCO_AVISOS_MS = 30000

export default function Layout() {
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [labels, setLabels] = useState({})
  const [prendidos, setPrendidos] = useState(null) // null = todavía no sabemos
  const [avisos, setAvisos] = useState([])

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
      .select('business_name, labels')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        setNombreNegocio(data?.business_name || 'Panel')
        setLabels(data?.labels ?? {})
      })
    cargarModulos()
    // Ajustes avisa cuando prende o apaga un módulo: la pestaña aparece
    // o desaparece sin recargar la página.
    window.addEventListener('fw:modules', cargarModulos)
    return () => window.removeEventListener('fw:modules', cargarModulos)
  }, [cargarModulos])

  useEffect(() => {
    async function revisar() {
      const lista = []
      try {
        const h = await fetch('/health').then((r) => r.json())
        if (h.whatsapp === 'sin configurar') {
          lista.push({ texto: 'WhatsApp sin conectar: los mensajes esperan en la cola.', to: '/conexion', accion: 'Conectar' })
        }
        if (h.llm === 'sin clave') {
          lista.push({ texto: 'Falta la clave del modelo de IA: el bot no contesta.', to: '/studio', accion: 'Cargar la clave' })
        }
      } catch {
        // El servidor no contesta: no hay nada útil que mostrar acá.
      }
      try {
        const st = await fetch('/api/install/status').then((r) => r.json())
        if (st.pending?.length) {
          lista.push({ texto: 'Hay cambios pendientes en la base de datos.', to: '/instalar', accion: 'Aplicar' })
        }
      } catch {
        // ídem
      }
      setAvisos(lista)
    }
    revisar()
    const t = setInterval(revisar, REFRESCO_AVISOS_MS)
    return () => clearInterval(t)
  }, [])

  // Mientras no sepamos qué módulos están prendidos, mostramos solo el
  // núcleo: es preferible que una pestaña aparezca un instante después a
  // que parpadee y desaparezca.
  const visible = (entrada) => !entrada.module || Boolean(prendidos?.has(entrada.module))

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand" title={nombreNegocio}>{nombreNegocio || 'Panel'}</div>
        {MENU.filter(visible).map(({ to, end, icon: Icono, texto }) => (
          <NavLink key={to} to={to} end={end}>
            <Icono size={17} />
            <span>{texto(labels)}</span>
          </NavLink>
        ))}
        <div className="spacer" />
        <button className="logout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} />
          <span>Salir</span>
        </button>
      </nav>
      <main className="content">
        {avisos.map((a) => (
          <div className="banner" key={a.to}>
            <AlertTriangle size={15} />
            <span>{a.texto}</span>
            <Link className="btn small" to={a.to}>{a.accion}</Link>
          </div>
        ))}
        <Outlet />
      </main>
    </div>
  )
}
