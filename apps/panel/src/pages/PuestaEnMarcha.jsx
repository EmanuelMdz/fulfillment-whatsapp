import { useState } from 'react'
import { Button, Card, Checkbox, Notice, PageHeader } from '../ui'

const PASOS = [
  { key: 'prompt', titulo: '1. Definí tu agente', to: '/studio', boton: 'Abrir Studio',
    texto: 'Cargá tu clave de IA y probá el modelo. En el prompt definí quién es el agente, su objetivo, la información que puede usar, los links, los datos a guardar y cuándo pasar al equipo.' },
  { key: 'simulador', titulo: '2. Probá el objetivo y los seguimientos', to: '/test', boton: 'Probar el bot',
    texto: 'Simulá una conversación completa. Revisá las respuestas, los datos que guardaría y la derivación. Definí la cadencia en el prompt y usá Probar seguimientos para ver qué enviaría. Sin reglas de seguimiento, no debe proponer recordatorios.' },
  { key: 'conexion', titulo: '3. Conectá el número', to: '/conexion', boton: 'Abrir Conexión',
    texto: 'Configurá el puente WAHA. Conservá el modo prueba y autorizá el teléfono que hará de lead antes de escanear el QR con el número dedicado al negocio. Después escribile desde el teléfono autorizado.' },
  { key: 'validacion', titulo: '4. Revisá el circuito completo', to: '/', boton: 'Ver conversaciones',
    texto: 'Comprobá que llega el mensaje, el agente responde y aparece la ficha en Leads. Probá derivación, respuesta humana, devolución al bot, seguimientos, filtro del modo prueba y reconexión. El equipo decide cuándo habilitar atención real.' },
]

export default function PuestaEnMarcha() {
  const [hechos, setHechos] = useState({})
  return <>
    <PageHeader title="Puesta en marcha" subtitle="De tu prompt a la primera conversación real." />
    <Notice className="mb-5">Esta base incluye conversaciones, leads y seguimientos. Un link de agenda se comparte en el chat; la reserva ocurre en la herramienta externa.</Notice>
    <div className="grid gap-5 lg:grid-cols-2">
      {PASOS.map((paso) => <Card key={paso.key} title={paso.titulo}>
        <p className="text-ink-2">{paso.texto}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button to={paso.to}>{paso.boton}</Button>
          <Checkbox label="Verificado en esta sesión" checked={Boolean(hechos[paso.key])}
            onChange={(e) => setHechos({ ...hechos, [paso.key]: e.target.checked })} />
        </div>
      </Card>)}
    </div>
  </>
}
