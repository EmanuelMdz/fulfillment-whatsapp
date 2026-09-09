# Probar el motor antes de entregarlo

Primero el simulador; después una instalación nueva con servicios y teléfonos reales.
La guía de conexión está en [DEPLOY.md](DEPLOY.md). En el panel, **Puesta en marcha**
resume el recorrido.

## 1. Objetivo en el prompt

1. En Studio cargá la clave de IA, probá el modelo y escribí el prompt.
2. En Probar el bot, recorré el objetivo: preguntas frecuentes, calificación o
   compartir tu link. No debe exigir productos, pedidos ni confirmaciones comerciales.
3. Revisá los datos que guardaría y una derivación con un motivo propio.
4. Cambiá el objetivo en Studio y empezá una conversación nueva en el simulador.
   El agente debe seguir el nuevo texto sin editar código.

## 2. Seguimientos

1. Definí cantidad, condiciones y demoras en el prompt.
2. Usá Probar seguimientos. La propuesta debe usar esa cadencia y la última respuesta.
3. Probá otra cadencia, por ejemplo un único seguimiento a las 72 horas.
4. Indicá que no haya seguimientos y comprobá que la lista quede vacía.
5. Probá rechazo, objetivo ya cumplido y pedido de no recibir más mensajes.
6. La ventana nocturna de Ajustes puede postergar la fecha. Revisá la hora calculada.

Los tests automáticos usan IA simulada. Estos pasos comprueban cómo interpreta
el prompt el modelo elegido en tu cuenta.

## 3. WhatsApp en modo prueba

Usá un número dedicado al negocio y otro teléfono como lead. El segundo número
va en **Conexión → Modo prueba**, antes de escanear el QR.

- Escribí “hola”: el chat aparece y el agente responde. La espera inicial
  de fábrica es de 90 segundos para reunir mensajes.
- Mandá tres mensajes seguidos: debe contestarlos juntos.
- Revisá que su propia respuesta no tome el control como si fuera humana.
- Compartí datos: deben aparecer en la ficha y en Leads.
- Corregí un dato: debe conservarse la nueva versión y el resto de la ficha.
- Pedí hablar con el equipo: pasa a Humano y aparece el motivo en Revisión.
- Si configuraste grupo de avisos, llega un solo aviso con link al chat.
- Respondé desde el panel y desde el teléfono del negocio: el agente se calla.
- Devolvé al bot: mantiene ese estado y retoma cuando corresponde.
- Cerrá el chat o tomá el control: sus seguimientos pendientes se cancelan.
- Con una cadencia corta escrita temporalmente en tu prompt de prueba, comprobá
  un seguimiento real; luego restaurá tu cadencia.
- Escribí antes de que venza el seguimiento: el anterior debe cancelarse.
- Desde un tercer teléfono no autorizado, escribí al negocio: el mensaje se
  guarda, pero no debe salir respuesta automática.
- Escribí en el grupo de avisos: el agente no responde al grupo.
- Desvinculá y volvé a conectar la sesión: el panel muestra la caída y recuperación.

No apagues el modo prueba hasta completar este recorrido.

## 4. Reinicio y entrega

Verificá reinicio del bot y reconexión del puente sin perder la sesión de WAHA;
el volumen debe estar montado en /app/.sessions.

Antes de entregar: prompt y links propios, datos ficticios retirados,
equipo y avisos configurados, zona horaria revisada y todas las pruebas anteriores
completas. El dueño debe saber tomar el control, devolver al agente y reconectar.

Para diagnóstico y respaldo, consultá [OPERACION.md](OPERACION.md).
