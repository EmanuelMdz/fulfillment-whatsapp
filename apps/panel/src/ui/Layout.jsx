import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { MessageSquare, Inbox, ClipboardList, Package, SlidersHorizontal, QrCode, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

/**
 * El esqueleto del panel: barra lateral en escritorio, barra superior
 * con solo íconos en el teléfono. El menú va a leer los módulos
 * prendidos cuando lleguen las pestañas opcionales (tanda 3).
 */
export default function Layout() {
  const [nombreNegocio, setNombreNegocio] = useState('')
  const [labels, setLabels] = useState({})

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
  }, [])

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand" title={nombreNegocio}>{nombreNegocio || 'Panel'}</div>
        <NavLink to="/" end>
          <MessageSquare size={17} />
          <span>Conversaciones</span>
        </NavLink>
        <NavLink to="/revision">
          <Inbox size={17} />
          <span>Revisión</span>
        </NavLink>
        <NavLink to="/pedidos">
          <ClipboardList size={17} />
          <span>{labels.order_plural ?? 'Pedidos'}</span>
        </NavLink>
        <NavLink to="/catalogo">
          <Package size={17} />
          <span>{labels.item_plural ?? 'Catálogo'}</span>
        </NavLink>
        <NavLink to="/studio">
          <SlidersHorizontal size={17} />
          <span>Studio</span>
        </NavLink>
        <NavLink to="/conexion">
          <QrCode size={17} />
          <span>Conexión</span>
        </NavLink>
        <div className="spacer" />
        <button className="logout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} />
          <span>Salir</span>
        </button>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
