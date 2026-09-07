# Guía: adaptar el bot a un cliente real

Esta guía es para dos lectores: el alumno que va a conectar el bot a un
negocio de verdad, y su Claude, que lo va a ayudar a hacerlo. Cuando alguien
diga *"quiero que el bot haga tal cosa"*, acá está dónde se toca y cómo.
Las recomendaciones son las de Ainnovate: salieron de tener este sistema
atendiendo clientes reales, y cada una tiene un motivo.

Regla de lectura para Claude: **primero el panel, después el código**. Casi
todo lo que un cliente pide se resuelve desde Studio, Ajustes o Catálogo,
sin tocar un archivo. Tocar código es para comportamientos que el panel no
tiene, y ahí van las reglas del final.

---

## 1. Cómo pensar este bot

Cinco ideas. Si el alumno las entiende, el resto es detalle.

1. **Atiende, no cierra.** El bot conversa, informa, junta datos y anota el
   pedido. Una persona lo confirma. Un bot que "cierra ventas solo" termina
   confirmando pedidos que no existen. Por eso el pedido nace en la primera
   etapa y el cliente recibe un "quedó anotado", nunca un "listo".
2. **El catálogo es el 80% de la calidad.** El campo "Lo que la IA sabe" de
   cada producto o servicio mueve más las respuestas que cualquier prompt.
   Un bot que contesta mal casi siempre tiene fichas vacías.
3. **Una persona siempre puede tomar el control.** Responder desde el panel
   o desde el celular del negocio calla al bot en ese chat. "Devolver al
   bot" lo destraba. Nadie queda preso del bot.
4. **Todo se configura desde el panel.** Prompts, claves, palabras, estados,
   motivos, tiempos. El código se toca cuando hace falta un comportamiento
   nuevo, no para cambiar un texto.
5. **Una instalación es un negocio.** Un número, una base, un deploy. Dos
   clientes son dos instalaciones. Se cobra cada una.

---

## 2. Antes de conectar a un cliente: la lista

En Ainnovate recomendamos no conectar el número hasta tener todo esto. Cada
punto que falte es un mensaje de soporte a la semana.

- [ ] **El modo prueba prendido** (Conexión) con tu número, ANTES de
      escanear el QR. Mientras esté prendido el bot solo te contesta a vos;
      a los demás les guarda el mensaje sin responder. Se apaga cuando todo
      está listo. Ver `docs/PRUEBAS.md`.
- [ ] **Un chip dedicado** al negocio. Nunca el personal del dueño ni el del
      alumno. Si lo bloquean, se pierde ese número y nada más.
- [ ] **El puente (WAHA) con volumen** en `/app/.sessions`. Sin volumen, cada
      redeploy pide escanear el QR.
- [ ] **Catálogo cargado con ficha**: cada cosa que el negocio ofrece, con
      precio y el campo "Lo que la IA sabe" completo. Ver `PROMPTS.md`.
- [ ] **El prompt con la voz del negocio**: un texto en markdown con sus
      secciones (quién sos, datos del negocio, reglas, cuándo derivar, cómo
      cerrar, seguimientos). El de fábrica es genérico a propósito.
- [ ] **El grupo de avisos** elegido en Studio, con el dueño adentro. Sin
      grupo, nadie se entera de un pedido ni de un cliente sin respuesta.
- [ ] **Zona horaria y ventana nocturna** correctas (Studio y Ajustes).
- [ ] **Diez preguntas en Probar el bot**: las que hacen los clientes de
      verdad, incluidas dos que el bot no debería saber contestar. Ver la
      lista en `PROMPTS.md`.
- [ ] **Un mensaje real** desde otro teléfono. Respuesta, aviso al grupo si
      corresponde, y el chat en Conversaciones.
- [ ] **El usuario del cliente** creado en Ajustes → Usuarios, con su
      contraseña.

---

## 3. Caso por caso

Organizado por lo que pide el cliente. La columna "dónde" es siempre una
pantalla del panel salvo que diga "código".

### Lo que dice y cómo lo dice

| El cliente quiere que… | Dónde | Cómo |
|---|---|---|
| Tenga otro tono, se presente distinto, hable de vos o de usted | Studio → Prompt, sección "Quién sos" | Reescribir con la voz del negocio. Plantilla en `PROMPTS.md`. |
| Conteste preguntas frecuentes: horarios, dirección, formas de pago, envíos, políticas | Studio → Prompt, "Datos del negocio" | Todo lo que es un hecho del negocio va ahí, en frases cortas. |
| Sepa de lo que vende y responda dudas de cada cosa | Catálogo → "Lo que la IA sabe" | Una ficha por producto o servicio: usos, variantes, garantía, las tres preguntas típicas y sus respuestas. |
| NO hable de algo, no prometa plazos, no dé descuentos | Studio → Prompt, "Reglas" | Frases que empiezan con "Nunca". El modelo las respeta mejor que las condicionales. |
| Use o no use emojis, hable en otro idioma | Studio → Prompt, "Quién sos" | Una línea explícita. |
| Diga otra cosa cuando anota un pedido | Studio → Prompt, "Cómo cerrar" | Ahí va la frase con la voz del negocio. Sin "listo" ni "confirmado": el equipo confirma después. |

### Cuándo interviene una persona

| El cliente quiere que… | Dónde | Cómo |
|---|---|---|
| Derive a una persona cuando pase tal cosa | Ajustes → Motivos de derivación, y Studio → Prompt, "Cuándo derivar" | Agregar el motivo (la clave se genera sola) y explicar en el prompt en qué situación usarlo. El bot solo puede elegir motivos que estén en la lista. |
| Alguien del negocio atienda desde el celular | Nada | Ya funciona: cuando una persona escribe desde el teléfono del negocio, el bot se calla en ese chat. Se devuelve desde Revisión o desde el chat. |
| El bot no atienda a cierto contacto (un proveedor, el dueño) | Conversaciones | Responderle desde el panel toma el control y el bot se calla ahí. Para que quede así, no devolverlo. Una lista de excluidos es una mejora pendiente. |
| Probar con el número real sin contestarle a clientes | Conexión → Modo prueba | Prendido, el bot solo responde a los números de la lista; al resto le guarda el mensaje. Es el paso previo obligatorio de toda instalación. |
| Los avisos lleguen a otro grupo, o a una persona | Studio → Grupo de avisos | Se elige de la lista de grupos del número conectado. |
| El bot se apague un rato (vacaciones, feriado) | Studio → Bot prendido | Apagarlo guarda los mensajes y frena las respuestas; al prenderlo contesta lo pendiente. |

### Pedidos y seguimientos

| El cliente quiere que… | Dónde | Cómo |
|---|---|---|
| Se llamen Reservas, Turnos, Ventas… | Ajustes → Diccionario | Siete palabras; el panel entero cambia. |
| El circuito tenga otras etapas | Ajustes → Estados | Renombrar etiquetas, agregar, ordenar. La primera es donde nace el pedido; las finales lo sacan de la bandeja. La clave no se edita: hay pedidos guardados con ella. |
| No mande recordatorios, o los mande distinto | Studio → Prompt, "Seguimientos" | Para que no mande ninguno: *"Nunca programes recordatorios: devolvé la lista vacía"*. Para cambiar el ángulo o la cantidad, se escribe la cadencia en esa sección. |
| No escriba de noche, o sí | Ajustes → Avanzado → Ventana nocturna | Horas locales del negocio. |
| Conteste más rápido | Ajustes → Avanzado → Espera antes de contestar | Bajar de 90 a 45 segundos es razonable. Menos de 30 hace que conteste tres veces a tres mensajes seguidos. |
| Muestre precios en otra moneda | Ajustes → Avanzado → Moneda | Es el símbolo que muestra el panel; los precios son enteros. |

### Horarios, stock, pagos, imágenes, audios

Estos son módulos de la Tanda 3 y todavía no tienen código (en Ajustes
aparecen como "próximamente"). Lo que se hace mientras tanto:

| El cliente quiere que… | Hoy | Cómo |
|---|---|---|
| Respete el horario de atención | Studio → Prompt, "Datos del negocio" y "Reglas" | Poner el horario y una regla: *"Fuera del horario, decí que se responde al abrir y no prometas hora"*. El bot ve la fecha y la hora local con día de semana en cada turno. |
| Sepa si hay stock | Catálogo | En la ficha: *"Consultar disponibilidad antes de confirmar"*, y el motivo de derivación que corresponda. |
| Cobre o mande un link de pago | Studio → Prompt, "Datos del negocio" | Los datos de pago (alias, cuenta, link fijo) y un motivo "Verificar pago" para derivar cuando el cliente dice que pagó. |
| Entienda fotos y audios | Nada por ahora | El bot sabe que llegó un archivo y contesta pidiendo el texto. Si el negocio recibe muchos comprobantes por foto, agregar al prompt: *"Si mandan una imagen, pedí que escriban el monto y la hora del pago"*. |

### Conexión y operación

| Situación | Dónde | Cómo |
|---|---|---|
| El número se desconectó | Conexión | Arrancar / reiniciar la sesión y escanear de nuevo. Pasa cuando el teléfono cerró sesión o el puente se redesplegó sin volumen. |
| El bot está mudo | Ver "Cuando algo se rompe", abajo | En orden: Métricas (turnos caídos), la pastilla de IA arriba, Studio → bot prendido, Conexión, registros de Railway. |
| Cambiar de modelo o de proveedor | Studio → Modelo de IA | Probar clave y modelo antes de guardar. Un 404 es un nombre de modelo que ya no existe. |
| Darle acceso al panel al cliente | Ajustes → Usuarios | Email y contraseña inicial; la cambia después. Todos ven todo. |
| Un segundo negocio del mismo cliente | Otra instalación | Otro Supabase, otro deploy, otro número. Se cobra aparte. |
| Traer las mejoras nuevas del repo de Ainnovate | GitHub → Sync fork | Railway redespliega. Si vino una migración, se aplica sola al arrancar (con el token). |

---

## 4. Cuando hay que tocar código

Lo que el panel no cubre se hace en el código, con Claude. Estas son las
reglas para que el cambio no rompa lo que ya anda. Claude tiene que
respetarlas aunque el alumno no las pida.

**Dónde vive qué**

| Quiero cambiar… | Archivo |
|---|---|
| Qué lee el modelo antes de contestar (el armado del prompt, el catálogo, el contrato JSON) | `apps/bot/src/agents/context.ts` |
| Qué hace el bot con la respuesta: guardas, pedido, derivación, seguimientos | `apps/bot/src/workers/turns.ts` |
| Cómo se planean los recordatorios | `apps/bot/src/agents/followup.ts` |
| Qué llega por WhatsApp y qué se ignora | `apps/bot/src/providers/waha.ts` y `routes/webhook.ts` |
| Cómo se crea un pedido desde el chat | `apps/bot/src/orders/from-chat.ts` |
| Los avisos al grupo | `apps/bot/src/notifications/notify.ts` |
| Una pantalla del panel | `apps/panel/src/pages/` con los componentes de `apps/panel/src/ui/` |
| Un campo nuevo en una tabla | Una migración nueva en `packages/db/migrations/` con el número que sigue |

**Lo que no se toca sin saber por qué existe**

- La cola de envío y sus pausas (`send-queue.ts`, Ajustes → Avanzado). Es
  lo que evita que bloqueen el número. Nunca se acelera para "que conteste
  más rápido".
- Una sola réplica en Railway. Dos réplicas son dos colas mandando en
  paralelo.
- El secreto del webhook, las policies de la base (`0008_equipo.sql`), la
  tabla de claves sin política. Son la seguridad del panel.
- Las migraciones ya aplicadas. Se agrega la siguiente, nunca se edita una.
- Los módulos: se prenden y se apagan por bandera. No se borra una carpeta.
- El sistema de diseño: una pantalla nueva usa `Card`, `Button`, `Table` y
  los tokens de `styles.css`. Nada de colores sueltos.

**Cómo se hace un cambio de código**

1. Describir el caso del cliente, no la solución técnica: *"cuando el
   cliente pide factura, el bot tiene que pedir el CUIT y derivar"*.
2. Claude propone dónde va (casi siempre: prompt + motivo, sin código). Si
   hace falta código, dice qué archivo y por qué.
3. Los comentarios explican **por qué**, en español. Los nombres de
   variables y tablas, en inglés.
4. `npm run check` tiene que pasar antes de pushear.
5. Se prueba en Probar el bot antes de que lo vea un cliente.

**Cambios de código típicos, y cómo se hacen**

- *Un campo nuevo en el catálogo* (talle, color, duración): migración
  `add column`, el campo en `Catalogo.jsx`, y la línea en `context.ts` para
  que el modelo lo vea.
- *Un dato nuevo que el bot tiene que juntar* (por ejemplo, el CUIT): no
  hace falta código. El prompt dice qué pedir (sección "Cómo cerrar"), y
  el bot lo guarda en la ficha del contacto (`datos` del contrato JSON).
- *Un aviso nuevo al grupo*: una función en `notify.ts` siguiendo las que
  hay (clave de episodio derivada del disparador, nunca de la hora) y la
  llamada desde `turns.ts`.
- *Un motivo de derivación con acción especial* (por ejemplo, que además
  mande un mensaje fijo): el motivo va en Ajustes; la acción, en
  `turns.ts`, en el bloque de `escalateReason`.

---

## 5. Lo que no hay que hacer

Cada punto salió de un problema real.

- **Acelerar la cola** o bajar las pausas para que "conteste más rápido".
  Es la forma más segura de que bloqueen el número.
- **Usar el número personal** del dueño o del alumno para probar.
- **Poner claves en el código** o en un archivo del repo. Van en el panel.
- **Prometer tiempos** en los mensajes fijos ("en un ratito te confirman").
  La confirmación depende de una persona.
- **Conectar sin grupo de avisos.** Un pedido esperando confirmación que
  nadie ve es una venta perdida y un cliente enojado.
- **Dejar el catálogo vacío** y esperar que el prompt lo compense. No lo
  compensa.
- **Escribir el prompt como un manual de diez páginas.** Frases cortas,
  reglas explícitas, hechos concretos. Ver `PROMPTS.md`.
- **Editar una migración aplicada** o borrar la carpeta de un módulo.

---

## 6. Cómo pedirle cambios a Claude

El alumno no tiene que saber dónde está cada cosa: para eso está esta guía
y para eso está Claude. Lo que sí tiene que hacer es **describir la
situación del cliente**, no la solución.

Bien:

> Es una veterinaria. Cuando alguien escribe que su animal está mal y no
> puede respirar, el bot tiene que decirle que vaya ya a la clínica más
> cercana y avisar al grupo. No tiene que intentar agendar nada.

Claude va a proponer: un motivo "Urgencia" (ya existe en el pack General),
una regla en el prompt con el texto exacto que hay que decir, y verificar
que el grupo de avisos esté configurado. Sin código.

Mal:

> Agregá un if en turns.ts para urgencias.

Otros pedidos que se resuelven bien así:

- *"El bot dice que hay envío gratis y no hay."* → Claude revisa el prompt y
  las fichas, encuentra dónde lo dice o dónde no dice lo contrario, y
  agrega la regla.
- *"Quiero que pida el nombre y el barrio antes de anotar un pedido."* →
  Prompt, sección "Cómo cerrar".
- *"Que los recordatorios sean solo uno y al día siguiente."* → Prompt,
  sección "Seguimientos".
- *"Cambiá Pedidos por Turnos en todo el panel."* → Diccionario y Estados.
- *"Quiero un campo Talle en cada producto y que el bot lo sepa."* → Código:
  migración, pantalla de catálogo, contexto. Claude lo hace completo y corre
  `npm run check`.

Cuando Claude conteste, que lo haga desde Ainnovate: qué recomendamos, por
qué, y qué no recomendamos. El alumno está aprendiendo a vender esto; la
explicación es parte del producto.

---

## 7. Cuando algo se rompe: dónde mirar

En orden. El primero que dé algo raro suele ser la causa.

1. **La pastilla de arriba del panel.** "WhatsApp sin configurar" o "IA sin
   clave" explican un bot mudo sin buscar más.
2. **Métricas → turnos caídos.** Si no está en cero, hubo clientes sin
   respuesta. La causa está en los registros.
3. **Studio → Bot prendido.** Alguien lo apagó para el feriado y se olvidó.
4. **Conexión.** Si la sesión no dice "Conectado", el número se desvinculó:
   escanear de nuevo.
5. **`https://tu-dominio/health`.** Dice si el servidor está vivo y qué le
   falta.
6. **Railway → Deployments → registros.** Cada turno, cada envío y cada
   error dejan una línea. Buscar `[turno] falló`, `[envío] falló`,
   `respondió 4`.
7. **La tabla `event_log`** en Supabase, filtrando por `severity = 'error'`.
   Es la memoria de lo que el sistema hizo y por qué, hasta 90 días atrás.

Si el problema es *"el bot contesta mal"*, no es una falla: es Probar el
bot → "Lo que lee la IA", y se corrige la ficha o el prompt.
