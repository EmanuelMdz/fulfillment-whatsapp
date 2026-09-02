import { BrowserRouter, Route, Routes } from 'react-router-dom'
import RequireAuth from './ui/RequireAuth.jsx'
import Layout from './ui/Layout.jsx'
import Conversaciones from './pages/Conversaciones.jsx'
import Revision from './pages/Revision.jsx'
import Pedidos from './pages/Pedidos.jsx'
import Catalogo from './pages/Catalogo.jsx'
import Studio from './pages/Studio.jsx'
import TestChat from './pages/TestChat.jsx'
import Metricas from './pages/Metricas.jsx'
import Conexion from './pages/Conexion.jsx'
import Ajustes from './pages/Ajustes.jsx'
import Instalar from './pages/Instalar.jsx'

/**
 * Las rutas del panel. El servidor devuelve index.html para cualquier
 * path que no sea API, así que recargar en /revision funciona igual.
 */
export default function App() {
  return (
    <BrowserRouter>
      <RequireAuth>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Conversaciones />} />
            <Route path="/revision" element={<Revision />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/test" element={<TestChat />} />
            <Route path="/metricas" element={<Metricas />} />
            <Route path="/conexion" element={<Conexion />} />
            <Route path="/ajustes" element={<Ajustes />} />
            {/* Ya instalado: la misma pantalla aplica las migraciones nuevas. */}
            <Route path="/instalar" element={<Instalar />} />
            <Route path="*" element={<Conversaciones />} />
          </Route>
        </Routes>
      </RequireAuth>
    </BrowserRouter>
  )
}
