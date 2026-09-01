# Porteo

Lista de trabajo para traer lo que ya funciona en el sistema de origen. Se marca
a medida que entra.

**Repos de origen** (no se tocan, solo se leen):
`CascadeProjects/Argos/bot-eccomerce` y `CascadeProjects/Argos/Argos`.

**Regla al portear**: se limpia todo rastro del negocio de origen — cadetería,
DAC, Montevideo, combos, márgenes, atribución de anuncios y los prompts
afinados. Si un archivo pierde sentido sin eso, no se portea: se rediseña.

De los 115 archivos del servidor de origen, **68 no mencionan ni una vez** ese
negocio y entran sin tocarse. El acoplamiento está en 23 archivos, y en varios es
apenas texto adentro de un prompt.

---

## Tanda 1 — Núcleo del bot

### Ya está en pie

El esqueleto que hace que el bot conteste, escrito de cero (no portado):

- [x] Migración `0002_bot.sql`: conversaciones, mensajes, cola de envío, prompts y episodios de aviso
- [x] Interfaz de proveedores y adaptador de WhatsApp
- [x] Webhook: guarda el mensaje, detecta que entró un humano y agenda el turno
- [x] Cola de envío: reclama de a uno, simula que escribe, hace una pausa y manda
- [x] Turno: espera, verifica que siga siendo el último mensaje, arma el contexto y contesta
- [x] Acceso al modelo con Gemini y OpenAI detrás de la misma función

**Cómo probarlo**: aplicá las migraciones (0001-0005) en orden, cargá las
claves, apuntá el webhook del puente a `/webhook/whatsapp` y mandate un
mensaje. Para ver derivaciones y pedidos hace falta la config del pack en
`app_config` (motivos y etapas) — hasta que exista el instalador, se
copia a mano desde `packages/core/src/index.js`.

### Lo que falta portar

> Nota (2026-09-01): el esqueleto reescribió proveedores, cola de envío y
> turnos de cero, así que "portar tal cual" pasó a ser "adaptar la lógica
> valiosa al esquema nuevo". Los archivos no se copian: se traducen.

- [x] Utilidades: reintentos con espera creciente y fecha con día de semana para el prompt
- [x] Observabilidad → tabla `event_log` + `logEvent()` con catálogo cerrado (0003)
- [x] `notifications/` → avisos al grupo con idempotencia por episodio, por la cola de envío; incluye el aviso "el bot no pudo contestar" (turno caído)
- [x] `message-processor.ts` → destilado al turno del producto (0004): decisión en JSON (mensajes + derivar + datos de ficha), guardas anti-loop / anti-repetición / respuesta vacía con línea puente, cola de revisión con motivos del pack, llave general del bot, reapertura de conversaciones cerradas. Los pasos de envío/cobro/visión/audio quedan para los módulos.
- [x] `knowledge-base.ts` + `kb-render.ts` → el catálogo con `bot_info` renderizado en `agents/context.ts` (producto o prestación por diseño de `catalog_items.kind`). Los bloques de envíos/pagos del origen quedan para los módulos `shipping`/`payments`.
- [x] `create-order.ts` → `orders/from-chat.ts`: el pedido nace en la primera etapa del negocio con precios del CATÁLOGO (nunca del modelo), gate humano (el bot anota, una persona confirma), guarda anti-duplicado por contacto y aviso "para CONFIRMAR" al grupo. Sin envíos.
- [x] `lead-state.ts` + `echo-handler.ts` — toma (esqueleto) + devolución con el invariante de `handback_at` (`handbackToBot`; la ruta del panel llega en la tanda 2)
- [x] Seguimientos automáticos (0005): la IA los planea después de cada respuesta (horas relativas, nunca fechas — el modelo alucina fechas), ventana nocturna 23-09 local, cancelación al escribir el cliente / al entrar una persona, descarte de vencidos (>24h de atraso), regla anti-repetición de ángulo
- [x] `queries.ts` — no se podó: se reescribió de cero al ritmo de las piezas (el `queries.ts` nuevo tiene solo lo que el producto usa)

**Listo cuando** el bot contesta un WhatsApp real con prompts cargados desde la
base, sin una sola línea del negocio de origen.

## Tanda 2 — Panel y conexión

- [x] Layout + Login + RequireAuth — escritos de cero contra el esquema nuevo (menú fijo por ahora; lee módulos en la tanda 3)
- [x] Conversaciones + hilo — espejo del WhatsApp con responder-como-humano (toma el control), devolver al bot y cerrar; mobile tipo WhatsApp (lista → hilo)
- [x] Revisión — la bandeja: motivo del pack o de guarda, abrir chat, devolver al bot, resolver
- [x] Studio — prompts editables (identidad / atención / seguimientos), nombre, zona horaria, grupo de avisos y llave general del bot
- [x] `lib/bot.js` + `lib/botApi.js` → `lib/supabase.js` (datos directo con RLS) + `lib/api.js` (acciones vía servidor con el access_token)
- [x] `motivos.js` → ya viven en la base (`app_config.escalation_reasons`, por pack) desde el diseño del núcleo
- [x] **Nuevo**: conectar el número por QR — arrancar sesión con webhook configurado solo, pantalla de estado y QR que se refresca
- [x] Vista `v_conversations_overview` (0006, security_invoker) para la lista de chats
- [ ] `TestChat.jsx` — probar el bot sin gastar un número
- [ ] `CustomerCard.jsx` — ficha del contacto (collected) + crear pedido pre-llenado desde el chat
- [x] Catálogo en el panel (con `bot_info` como campo estrella — absorbe a `ProductBotTab`) + pestaña de pedidos con etapas del pack y "Abrir chat" (cierra el circuito del pedido del bot)
- [ ] `Metricas.jsx` — podar
- [x] **Nuevo**: instalador completo — corre las migraciones que falten (tabla `_migrations`, una transacción por archivo), escribe la config del pack desde `packages/core`, prende los módulos, siembra el catálogo de ejemplo y crea el usuario dueño. Re-ejecutable sin miedo.

**Listo cuando** alguien que nunca vio el repo clona, corre el instalador,
escanea el código y responde un mensaje desde el panel en menos de treinta
minutos.

## Tanda 3 — Los dos packs

- [ ] Banderas de módulos y menú dinámico
- [ ] Diccionario, estados y motivos editables desde el panel
- [ ] Módulos `stock`, `payments`, `vision`, `audio`
- [ ] **Nuevo**: módulo `hours` — horario de atención
- [ ] **Nuevo**: módulo `team` — asignar casos a personas
- [ ] **Nuevo**: origen de catálogo conectable a un ecommerce externo
- [ ] Documentación por módulo

**Listo cuando** el mismo repo levanta una tienda y una clínica cambiando
banderas y tres listas, y en la clínica no aparece la palabra "venta" en ningún
lado.

---

## Lo que NO se portea

| Qué | Por qué |
|---|---|
| Prompts afinados del negocio de origen | Son el activo. El código lo copia cualquiera |
| Cadetería, cortes, liquidaciones, remitos, rol de depósito | Específico de un modelo logístico local |
| Atribución de anuncios con ventana temporal | La pieza más frágil y la que más soporte genera. Después de la v1 |
| Combos, margen neto contra bruto, caja personal | Contabilidad de ese negocio, no del producto |
| Reconciliador y colas de entrada y salida | Solo se justifica con volumen. Segunda versión |
| Toda la documentación interna | Llena de incidentes y datos reales. Se reescribe de cero |
