import { BrowserRouter, Route, Routes } from 'react-router-dom'
import RequireAuth from './ui/RequireAuth.jsx'
import Layout from './ui/Layout.jsx'
import Conversaciones from './pages/Conversaciones.jsx'
import Revision from './pages/Revision.jsx'
import Leads from './pages/Leads.jsx'
import Studio from './pages/Studio.jsx'
import TestChat from './pages/TestChat.jsx'
import Metricas from './pages/Metricas.jsx'
import Conexion from './pages/Conexion.jsx'
import Ajustes from './pages/Ajustes.jsx'
import Instalar from './pages/Instalar.jsx'
import PuestaEnMarcha from './pages/PuestaEnMarcha.jsx'

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
            <Route path="/leads" element={<Leads />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/test" element={<TestChat />} />
            <Route path="/metricas" element={<Metricas />} />
            <Route path="/conexion" element={<Conexion />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="/puesta-en-marcha" element={<PuestaEnMarcha />} />
            {/* Ya instalado: la misma pantalla aplica las migraciones nuevas. */}
            <Route path="/instalar" element={<Instalar />} />
            <Route path="*" element={<Conversaciones />} />
          </Route>
        </Routes>
      </RequireAuth>
    </BrowserRouter>
  )
}
