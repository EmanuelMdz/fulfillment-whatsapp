# Adaptar el agente a un negocio

La base es un motor de WhatsApp con conversaciones, leads y seguimientos.
Primero configurá **Studio → Prompt**, siguiendo [PROMPTS.md](PROMPTS.md).

| Necesidad | Dónde se define |
|---|---|
| Otro objetivo: responder, calificar, compartir un link | Prompt |
| Información, tono, preguntas frecuentes, links | Prompt |
| Datos a pedir y guardar en la ficha | Prompt |
| Etapas del lead y cuándo cambiarlas | Prompt: dato etapa, con valores libres |
| Cuándo derivar y motivo | Prompt, en texto libre |
| Contenido, cantidad y cadencia de seguimientos | Prompt |
| Clave de IA, modelo y grupo de avisos | Studio |
| Pausas, espera antes de responder y ventana nocturna | Ajustes |
| Número dedicado y teléfonos de prueba | Conexión |
| Acciones reales en herramientas externas | Nueva integración en código |

El motor ejecuta las capacidades que ya tiene. Un prompt no instala conectores.
Por ejemplo, puede compartir tu enlace de agenda; no puede verificar una reserva
si nadie conectó esa agenda.

## El CRM básico

**Conversaciones** muestra el chat y permite responder como humano, devolverlo
al agente o cerrarlo. **Leads** muestra la ficha, permite buscar por datos y
corregir la etapa. **Revisión** reúne las derivaciones al equipo.
**Métricas** muestra leads, conversaciones, respuestas, derivaciones y seguimientos.

Los datos del lead se conservan y se vuelven a incluir como contexto del agente.
El motor no exige un nombre, dirección, presupuesto o una etapa concreta.

## Qué conserva el código

Autenticación, historial, formato de respuesta, cola única, pausas, recepción
sin duplicados, guardas de repetición, modo prueba, cancelación de seguimientos
y control humano. Esas son reglas operativas, independientes del objetivo.

Si la IA devuelve una respuesta vacía, el chat pasa al equipo sin enviar una
frase fija. Si da un horario de seguimiento inválido, ese mensaje no se agenda.

## Extender

Catálogo y pedidos de la versión anterior quedan como código de referencia y
tablas históricas, fuera del panel y del flujo inicial. No se eliminan datos al
actualizar. Si tu caso necesita esas funciones, desarrollá una extensión con
su propia interfaz y pruebas; no las conviertas en requisitos del agente básico.

No levantes dos bots contra la misma base ni alteres la cola para acelerar
mensajes. Antes de habilitar atención real, completá [PRUEBAS.md](PRUEBAS.md).

## Actualizar una instalación anterior

Aplicá las migraciones y revisá el prompt de Studio: los prompts de negocios ya
instalados se conservan. Reemplazá las instrucciones de catálogo/pedidos por tu
objetivo actual. Los seguimientos existentes conservan su texto y fecha; cerrá
las conversaciones correspondientes si querés cancelar esos pendientes.
