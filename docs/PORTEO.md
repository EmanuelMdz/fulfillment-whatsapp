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

- [ ] Proveedores, agentes, cola de envío, crons, observabilidad, utilidades — 68 archivos, entran tal cual
- [ ] `message-processor.ts` (2.024 ln) — portar entero y sacarle los pasos de envío y cobro a puntos de extensión
- [ ] `knowledge-base.ts` + `kb-render.ts` (587 ln) — generalizar a producto o prestación
- [ ] `create-order.ts` (453 ln) — sacarle los envíos, dejarlo genérico
- [ ] `lead-state.ts` + `echo-handler.ts` — toma y devolución del control humano, tal cual
- [ ] `notifications/` (443 ln) — avisos idempotentes por episodio, tal cual
- [ ] `queries.ts` (1.336 ln) — podar lo que no aplica
- [ ] Migración `0002_bot.sql` con las tablas de conversación

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
