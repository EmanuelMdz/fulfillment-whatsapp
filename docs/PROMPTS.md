# Un prompt para definir el agente

El objetivo, la voz, los datos del negocio, los links, la información a
recopilar y las reglas de seguimiento viven en **Studio → Prompt**.
Cambiar de caso de uso no requiere editar el motor.

El código agrega fecha, ficha del lead y formato de respuesta. No agrega
un catálogo, una venta obligatoria, un cierre comercial ni un plazo de
seguimiento.

## Plantilla

```markdown
## Quién sos
Sos [rol] de [negocio]. Hablás de [vos/tú/usted], con tono [descripción].

## Objetivo
Tu objetivo es [resultado concreto].
Lo considerás cumplido cuando [evidencia observable en esta conversación].

## Información del negocio
[Información verificada, preguntas frecuentes y respuestas.]
[Links exactos que puede compartir y para qué sirve cada uno.]

## Datos del lead
Pedí [datos necesarios], en [qué momento].
Guardalos en la ficha con las claves [nombres de los datos].
Si querés etapas: guardá el dato etapa con [valores y condiciones].

## Reglas
No inventes información ni links.
No afirmes que ejecutaste una acción externa que no podés comprobar.
[Restricciones y forma de responder de este negocio.]

## Cuándo derivar
Pasá al equipo cuando [situaciones]. Explicá el motivo brevemente.

## Seguimientos
[Sin seguimientos / cantidad, condiciones y demoras desde la última respuesta.]
[Cuándo dejar de escribir: objetivo cumplido, rechazo, pedido de no contacto…]
```

Las secciones son sugerencias. Podés reorganizarlas: el sistema lee el texto completo.
Los motivos de derivación son texto libre; no requieren cargarse en otra pantalla.
Las etapas también son libres: el motor no contiene un embudo comercial.

## Ejemplo: compartir un link de agenda

Ejemplo ficticio para reemplazar con datos propios:

```markdown
## Quién sos
Sos el asistente de un estudio de diseño. Respondés de vos, breve y cordial.

## Objetivo
Conocer qué necesita la persona y, si quiere conversar con el equipo,
compartir https://example.invalid/agenda.
Compartir el enlace no significa que la persona ya reservó.

## Información
El estudio diseña identidades visuales y sitios web.
La primera conversación sirve para conocer el proyecto.

## Datos del lead
Preguntá nombre y qué proyecto tiene en mente.
Guardá nombre_completo e interes.
Guardá etapa como Consulta abierta mientras reunís información, y como
Link compartido cuando envíes el enlace.

## Cuándo derivar
Si pide hablar con alguien o necesita una respuesta que no tenés, pasá al equipo.

## Seguimientos
Si compartiste el link y quedó una consulta pendiente, un solo mensaje a las
24 horas retomando esa consulta.
Ninguno si ya resolvió su consulta, rechazó continuar o pidió no recibir mensajes.
```

El link es ficticio. Reemplazalo antes de usar este ejemplo.
Para un agente de preguntas frecuentes, reemplazá el objetivo y la información;
para calificación, definí las preguntas y los criterios en ese mismo texto.

## Qué puede hacer la base

Enviar texto y links, guardar pares de texto en la ficha, derivar al equipo y
programar seguimientos. Una agenda, pago o formulario ocurre fuera de este motor.
Verificar reservas, cobrar o ejecutar acciones externas requiere una integración.

El dato `etapa` aparece en Leads y también puede editarlo el equipo. Por sí solo
no cierra el chat ni cancela tareas. Las reglas del prompt deciden si proponer
seguimientos; cerrar una conversación o tomar el control cancela sus pendientes.

## Cómo funcionan los seguimientos

El planificador lee el mismo prompt, la ficha y el historial, incluida la última
respuesta del bot. Decide texto y demora. Si no hay una cadencia definida,
se le indica que no programe nada.

El motor acepta horas positivas y fechas válidas. Descarta valores inválidos;
no los reemplaza por horarios aleatorios. La ventana nocturna de Ajustes puede
postergar el envío. Si el lead escribe o entra una persona, se cancelan los
pendientes. Los planes ya guardados no se reescriben al editar el prompt:
para detenerlos, cerrá la conversación desde el panel.

Las instrucciones se interpretan con IA: probalas con conversaciones representativas.

## Verificación

1. Saludo y consulta sobre información que sí figura en el prompt.
2. Consulta sobre un dato desconocido.
3. Camino completo hasta el objetivo.
4. Captura y corrección de un dato del lead.
5. Derivación con un motivo propio del negocio.
6. Seguimiento a la demora indicada.
7. Rechazo o pedido de no volver a escribir: ningún seguimiento.
8. Cambio de objetivo en Studio: el simulador sigue el nuevo objetivo.

`prompts/negocio.md` es una copia de trabajo. `npm run prompt:pull` trae el
texto de Studio; `npm run prompt:push` lo reemplaza por el archivo.
