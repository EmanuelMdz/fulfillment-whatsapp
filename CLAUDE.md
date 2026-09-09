# Motor de WhatsApp — reglas del repo

Este producto es una base para que un alumno cree su propio agente.
El núcleo incluye mensajes, leads, conversaciones, seguimientos y control humano.
**El objetivo y las reglas del negocio viven en el prompt de Studio.**
No vuelvas a introducir un catálogo obligatorio, pedidos, packs por rubro,
un embudo fijo ni una cadencia comercial en el código.

## Adaptar el prompt

Leé docs/GUIA.md y docs/PROMPTS.md. Reuní objetivo, información verificada,
links, tono, datos que necesita el negocio, condiciones para derivar y reglas
de seguimiento. Escribí prompts/negocio.md y probá en el simulador.
Si Studio ya fue editado, traé primero su texto con npm run prompt:pull.
Publicar ese archivo con prompt:push reemplaza el prompt de la base conectada;
hacelo dentro del alcance autorizado por el dueño.

Los motivos de derivación y los datos de la ficha son texto libre. El dato
etapa puede mostrar un estado en Leads; el prompt define los valores.

## Reglas del desarrollo

- No importar datos, nombres ni prompts de Argos o de clientes reales.
- Un negocio, una base y un deploy. El panel se compila dentro del bot.
  Una sola réplica, sin otro servicio para la interfaz ni CORS.
- Extensiones por módulo; no borrar datos ni tablas de una instalación
  existente. El código de catálogo/pedidos anterior queda como referencia,
  fuera del flujo y menú iniciales.
- No editar migraciones ya aplicadas. Agregar la siguiente numerada.
  Toda tabla nueva tiene RLS y los RPC administrativos son solo de service_role.
- Conservar cola, pausas, secreto del webhook, controles de acceso,
  modo prueba, recepción atómica y toma de control humana.
- Todo se configura desde el panel, salvo conexión a Supabase en el entorno.
  No exponer claves privadas al navegador ni a Git.
- Interfaz en español, sin emojis. Usar tokens de styles.css y componentes
  de ui/. En teléfono las tablas se convierten en tarjetas sin scroll lateral.
  El icono de WhatsApp es monocromo y no implica integración oficial.
- Código para aprender: nombres claros y comentarios que explican el motivo.
- No iniciar Docker, Supabase local ni servicios duplicados sin pedido explícito.
- Antes de proponer: npm run check y npm audit. No pushear sin autorización
  de Emanuel. No desplegar ni aplicar migraciones a su base por una prueba local.

## Mapa

| Pieza | Lugar |
|---|---|
| Texto de sistema y formato de acciones | apps/bot/src/agents/context.ts |
| Decisión: mensajes, datos, derivación | apps/bot/src/agents/decision.ts |
| Planificación de seguimientos | apps/bot/src/agents/followup.ts |
| Turnos y envío | apps/bot/src/workers/ |
| Acceso a datos | apps/bot/src/db/queries.ts |
| Panel y componentes | apps/panel/src/ |
| Instalador y valores iniciales | routes/install.ts y packages/core/src/ |
| Migraciones | packages/db/migrations/ |
| Prompt de trabajo | prompts/negocio.md |
| Pruebas sin cuentas reales | tests/ |

El planificador debe ver la última respuesta del agente y la ficha del lead.
No reemplazar horas inválidas por una cadencia inventada. El registro del plan
debe verificar que el lead no volvió a escribir ni entró una persona mientras
la IA estaba pensando.

Compartir un link no equivale a ejecutar o verificar una acción externa.
Las integraciones nuevas requieren código y pruebas de su efecto.
