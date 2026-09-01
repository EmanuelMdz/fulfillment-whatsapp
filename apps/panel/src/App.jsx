import { BrowserRouter, Route, Routes } from 'react-router-dom'
import RequireAuth from './ui/RequireAuth.jsx'
import Layout from './ui/Layout.jsx'
import Conversaciones from './pages/Conversaciones.jsx'
import Revision from './pages/Revision.jsx'
import Studio from './pages/Studio.jsx'
import Conexion from './pages/Conexion.jsx'

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
            <Route path="/studio" element={<Studio />} />
            <Route path="/conexion" element={<Conexion />} />
            <Route path="*" element={<Conversaciones />} />
          </Route>
        </Routes>
      </RequireAuth>
    </BrowserRouter>
  )
}
