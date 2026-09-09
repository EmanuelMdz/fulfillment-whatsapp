# Motor de WhatsApp · Ainnovate

Una base para crear tu propio agente: responde mensajes, guarda leads,
mantiene las conversaciones y programa seguimientos. **Su objetivo se define
en un único prompt editable**, en Studio.

Podés orientarlo a responder preguntas, calificar contactos, compartir un link
de agenda o entregar información. La instalación inicial no pide un catálogo,
no crea pedidos ni elige un rubro.

## Primer resultado

Seguí [Primeros pasos](docs/PRIMEROS_PASOS.md): duplicar → instalar →
escribir tu prompt → probar en el simulador → conectar WhatsApp en modo prueba.

## Qué incluye

- WhatsApp por QR mediante WAHA.
- Conversaciones, respuesta humana y devolución al bot.
- Leads con una ficha de datos definida por el prompt.
- Etapas libres: indicá en el prompt cuándo guardar el dato `etapa`.
- Un prompt editable, simulador de conversación y prueba de seguimientos.
- Seguimientos con contenido, cantidad y cadencia definidos en el prompt.
- Revisión y avisos al equipo, métricas, usuarios y modo prueba.
- Instalador web y migraciones de Supabase.

El motor valida el formato, conserva el historial, organiza las colas y aplica
los controles de envío. El prompt define qué conseguir y cómo conversar.
Compartir un link no ejecuta acciones en una agenda, formulario o sitio externo;
esas integraciones se pueden desarrollar sobre esta base.

## Qué necesitás

Un proyecto nuevo de Supabase, GitHub y Railway para publicar, una clave de IA
propia y WAHA con un número dedicado para WhatsApp.
Para trabajar localmente: Git, Node.js **24** y npm.

**En tu computadora**, dentro de tu copia:

```bash
npm ci
npm run setup
npm run build
npm run doctor
npm run dev
```

Abrí http://localhost:3000 y completá el asistente con tu negocio y usuario.
La URL de Supabase y el token de acceso se explican en [Deploy](docs/DEPLOY.md),
junto con el modo manual con claves de proyecto.

Primero Studio → clave y prompt → Probar el bot. Después configurá WhatsApp
en modo prueba y autorizá el teléfono que hará de lead.

Una instalación es un negocio: una base, un bot y un puente. No ejecutes el bot
local y el publicado contra la misma base al mismo tiempo. WAHA es un puente
no oficial; la sesión puede desconectarse o el número sufrir bloqueos.

## Comandos

| Comando | Resultado |
|---|---|
| `npm run check` | Tests aislados, TypeScript y compilación |
| `npm run doctor` | Diagnóstico local sin contactar cuentas ni imprimir claves |
| `npm run demo` | Cinco conversaciones y leads ficticios en una base de aprendizaje instalada |
| `npm run demo:limpiar` | Quita exclusivamente los datos marcados de la demo |
| `npm run prompt:pull` | Copia el prompt de Studio a `prompts/negocio.md` |
| `npm run prompt:push` | Reemplaza el prompt de Studio por el archivo local |
| `npm run db:sql` | Muestra el SQL de instalación y actualización |

La demo no usa IA ni envía mensajes; requiere Supabase y el asistente terminado.
Sus seguimientos quedan cancelados.

## Guías

- [Primeros pasos](docs/PRIMEROS_PASOS.md) y [Deploy](docs/DEPLOY.md).
- [Adaptar el agente](docs/GUIA.md) y [escribir el prompt](docs/PROMPTS.md).
- [Pruebas](docs/PRUEBAS.md) y [Operación](docs/OPERACION.md).
- [Desarrollar](CONTRIBUTING.md) y [estado de lanzamiento](docs/LANZAMIENTO.md).

El código y las tablas de catálogo/pedidos de versiones anteriores se conservan
como material para futuras extensiones; están fuera del motor y del panel inicial.
PLAN, PORTEO, AUDITORIA y TEMARIO son contexto histórico, no el alcance actual.
