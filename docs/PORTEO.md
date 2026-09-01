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

**Cómo probarlo**: aplicá las dos migraciones, cargá las claves, apuntá el
webhook del puente a `/webhook/whatsapp` y mandate un mensaje.

### Lo que falta portar

> Nota (2026-09-01): el esqueleto reescribió proveedores, cola de envío y
> turnos de cero, así que "portar tal cual" pasó a ser "adaptar la lógica
> valiosa al esquema nuevo". Los archivos no se copian: se traducen.

- [x] Utilidades: reintentos con espera creciente y fecha con día de semana para el prompt
- [x] Observabilidad → tabla `event_log` + `logEvent()` con catálogo cerrado (0003)
- [x] `notifications/` → avisos al grupo con idempotencia por episodio, por la cola de envío; incluye el aviso "el bot no pudo contestar" (turno caído)
- [x] `message-processor.ts` → destilado al turno del producto (0004): decisión en JSON (mensajes + derivar + datos de ficha), guardas anti-loop / anti-repetición / respuesta vacía con línea puente, cola de revisión con motivos del pack, llave general del bot, reapertura de conversaciones cerradas. Los pasos de envío/cobro/visión/audio quedan para los módulos.
- [ ] `knowledge-base.ts` + `kb-render.ts` (587 ln) — generalizar a producto o prestación
- [ ] `create-order.ts` (453 ln) — sacarle los envíos, dejarlo genérico
- [x] `lead-state.ts` + `echo-handler.ts` — toma (esqueleto) + devolución con el invariante de `handback_at` (`handbackToBot`; la ruta del panel llega en la tanda 2)
- [ ] Seguimientos automáticos (followup-agent + schedule + crons)
- [ ] `queries.ts` (1.336 ln) — podar lo que no aplica

**Listo cuando** el bot contesta un WhatsApp real con prompts cargados desde la
base, sin una sola línea del negocio de origen.

## Tanda 2 — Panel y conexión

- [ ] `AdminLayout` + `Login` + `RequireAuth` (313 ln) — que el menú lea los módulos
- [ ] `Conversaciones` + `ChatThread` + `Avatar` (614 ln) — tal cual
- [ ] `Revision.jsx` (394 ln) — tal cual
- [ ] `Studio.jsx` (490 ln) — tal cual, incluye la configuración de avisos
- [ ] `TestChat.jsx` (228 ln) — tal cual
- [ ] `ProductBotTab.jsx` (199 ln) — tal cual
- [ ] `Metricas.jsx` (201 ln) — podar
- [ ] `CustomerCard.jsx` (796 ln) — podar los campos de logística
- [ ] `Products` + `ProductForm` + `Stock` (1.126 ln) — simplificar
- [ ] `lib/bot.js` + `lib/botApi.js` (706 ln) — tal cual
- [ ] `motivos.js` (25 motivos) — mover a la base como catálogo por pack
- [ ] **Nuevo**: conectar el número por QR — crear sesión, pedir el código, dejar el webhook configurado, pantalla de estado
- [ ] **Nuevo**: instalador que corra migraciones, siembre y cree el usuario dueño

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
