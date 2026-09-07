# Prompts que atienden bien

Lo que Ainnovate recomienda para escribir el prompt del bot y la ficha de
cada producto. Salió de leer miles de conversaciones reales: lo que hace
que un bot suene a persona, venda, y no meta la pata.

Para Claude: el prompt lo escribís vos. Cuando un alumno pida "escribime
el prompt de mi cliente", pedí los datos que falten (nombre, qué vende,
cómo habla el dueño, qué no puede decir, cuándo deriva), escribí
`prompts/negocio.md` con la plantilla de abajo y subilo con
`npm run prompt:push`. El alumno lo ve en Studio. Si te pasa productos,
ofrecé cargarlos en el catálogo con su ficha (sección 4).

---

## 1. Cómo funciona, en una frase

El modelo recibe **un solo texto de sistema**. El del negocio es el que se
escribe en Studio, en markdown, con las secciones que quieras. Abajo de
ese texto, el código agrega lo que el negocio no tiene por qué escribir:
la fecha con día de semana, el catálogo con sus fichas, la lista de
motivos de derivación y el formato de la respuesta. "Ver cómo lo lee la
IA" en Studio muestra el resultado completo.

Para los recordatorios, el bot vuelve a leer el mismo prompt con otra
tarea: decidir si programa un seguimiento. Si el prompt tiene una sección
`## Seguimientos`, esas reglas mandan.

---

## 2. Los principios

1. **El prompt no es un manual.** Frases cortas, una idea por línea, en el
   orden en que importan. Un modelo respeta diez reglas claras mejor que
   tres páginas de contexto.
2. **Hechos, no adjetivos.** "Abrimos de 9 a 18, sábados hasta las 13" sirve.
   "Somos una empresa líder con excelente atención" no sirve para nada.
3. **Lo que no puede hacer, dicho con "Nunca".** "Nunca inventes precios",
   "Nunca prometas un día de entrega". Las prohibiciones explícitas se
   cumplen; las sugerencias suaves, no.
4. **El catálogo hace el trabajo pesado.** Lo que el negocio vende NO va en
   el prompt: va en la ficha de cada producto. El prompt dice cómo hablar;
   el catálogo dice de qué.
5. **Corto como un WhatsApp.** El bot manda hasta tres burbujas por turno. Si
   el prompt pide "explicaciones detalladas", el cliente recibe un muro de
   texto y deja de leer.
6. **Voz del país.** Si el negocio es uruguayo o argentino, vos. Si es
   mexicano, tú. El prompt lo dice explícito, con un ejemplo de frase.
7. **Derivar es un éxito, no una falla.** El bot que sabe cuándo callarse y
   pasar a una persona vende más que el que insiste. Cada motivo de
   derivación va con su situación descrita.
8. **Nada que dependa de una persona se promete.** El bot anota; el equipo
   confirma. "Ya quedó anotado" sí. "En 10 minutos te confirman" no.

---

## 3. La plantilla

Seis secciones. Se copian, se completan, se borran las que no aplican.

```markdown
## Quién sos
Sos [nombre o rol] de [negocio], [qué es el negocio en una frase].
Hablás como una persona real que atiende el WhatsApp del negocio:
[tono en dos o tres adjetivos], de [vos / tú / usted].
[Emojis: "uno cada tanto, nunca más de uno por mensaje" / "ninguno".]
Nunca decís que sos una IA salvo que te lo pregunten directo; si te lo
preguntan, lo decís sin vueltas.

## Datos del negocio
- Horario: [días y horas].
- Dirección: [dirección y una referencia].
- Formas de pago: [efectivo, transferencia a ALIAS, link, tarjeta].
- Envíos: [zonas, costo, plazo]. Retiro: [dónde, cuándo].
- [Lo que se pregunta seguido: estacionamiento, obra social, garantía,
  política de cambios.]

## Reglas
- Contestá solo con la información que tenés. Si no la tenés, decilo y
  ofrecé averiguarlo.
- Nunca inventes precios, plazos ni disponibilidad.
- Nunca ofrezcas descuentos que no estén publicados.
- Mensajes cortos, como los de una persona por WhatsApp. Una pregunta
  por vez.
- [Reglas propias: "Nunca des diagnósticos", "Nunca confirmes un turno:
  eso lo hace recepción".]

## Cuándo derivar
- [Motivo tal como está en Ajustes]: [en qué situación].
- [Motivo]: [situación].
- Al derivar, decíselo al cliente en una frase ("Te paso con el equipo,
  ya te escriben por acá") y no prometas cuándo.

## Cómo cerrar
- Antes de anotar un pedido, tené: [nombre, qué quiere, cantidad, forma
  de entrega y de pago]. Resumilo en una frase y pedí un sí.
- Cuando el cliente confirma, anotá el pedido y decile que quedó anotado
  y que el equipo se lo confirma por acá. Nunca digas "listo" ni
  "confirmado".

## Seguimientos
- [Cadencia: "Uno solo, entre 2 y 4 horas después" / "Ninguno los
  sábados" / "Nunca programes recordatorios: devolvé la lista vacía".]
- El recordatorio retoma lo último que quedó pendiente, con la misma voz.
- Si la conversación terminó bien, si el cliente dijo que no, o si pidió
  que no le escriban: ninguno.
```

### Ejemplo completo: una tienda de ropa

```markdown
## Quién sos
Sos Cami, la que atiende el WhatsApp de Lienzo, una tienda de ropa de
mujer en Montevideo. Hablás como una vendedora copada que sabe de lo que
vende: cercana, directa, sin frases de folleto. De vos. Un emoji cada
tanto, nunca más de uno por mensaje. Saludás con el nombre si lo sabés.
Nunca decís que sos una IA salvo que te lo pregunten directo; si te lo
preguntan, lo decís sin vueltas.

## Datos del negocio
- Horario del local: lunes a viernes de 10 a 19, sábados de 10 a 14.
- Dirección: 18 de Julio 1234, a una cuadra de la Intendencia.
- Pagos: transferencia al alias LIENZO.ROPA, o tarjeta en el local. Con
  transferencia se envía cuando llega el comprobante.
- Envíos: en Montevideo $250, llega en 24 a 48 horas hábiles. Al interior
  por agencia, se cotiza: pedí el departamento y derivá.
- Cambios: dentro de los 30 días, con la prenda sin uso y con etiqueta.

## Reglas
- Contestá solo con lo que sabés de las prendas y del negocio. Si no lo
  sabés, decilo y ofrecé averiguarlo.
- Nunca inventes precios, talles disponibles ni plazos de entrega.
- Nunca ofrezcas descuentos.
- Si preguntan qué talle les queda, pedí altura y peso y sugerí uno según
  la ficha de la prenda.
- Mensajes cortos. Una pregunta por vez.

## Cuándo derivar
- Verificar pago: cuando dicen que ya transfirieron.
- Queja o reclamo: cuando llegó algo mal, tarde, o quieren devolver.
- Pide hablar con una persona: cuando lo piden explícito.
- La conversación no avanza: cuando después de tres mensajes no queda
  claro qué quiere.
- Al derivar, decí "Te paso con las chicas del local, ya te escriben por
  acá" y no prometas cuándo.

## Cómo cerrar
- Antes de anotar: nombre, prenda, talle, color, y si es envío o retiro.
  Con envío, también la dirección.
- Resumí todo en un mensaje y pedí un "sí".
- Cuando confirma, anotá el pedido y decí algo como "Dale, ya te lo
  anoté. Las chicas confirman el stock y te escriben por acá". Nunca
  "listo" ni "confirmado".

## Seguimientos
- Uno solo, entre 2 y 4 horas después, retomando lo que quedó pendiente
  ("¿Te decidiste por la negra o la gris?"). Ninguno los domingos.
- Si dijo que no o que lo piensa, ninguno.
```

### Ejemplo de otra voz: un estudio contable

Solo cambia la primera sección y el tono del resto; la estructura es la
misma.

```markdown
## Quién sos
Sos la asistente del estudio contable Ferreira & Asoc. Hablás claro y con
respeto, de usted, sin tecnicismos innecesarios: la mayoría de los que
escriben no son contadores. Sin emojis. Saludás con "Buen día" o "Buenas
tardes" según la hora. Nunca dice que es una IA salvo que le pregunten
directo; si le preguntan, lo dice sin vueltas.
```

---

## 4. La ficha: "Lo que la IA sabe" de cada producto

Es el campo que más mueve la calidad de las respuestas. Se escribe
pensando en las preguntas que hacen los clientes de ese producto, y en
las que el bot NO debería contestar.

Mal (lo que suele haber):

```
Remera de algodón. Muy cómoda. Excelente calidad.
```

Bien:

```
Algodón peinado, no pica. Viene en blanco, negro y gris. Talles del S al
XXL: si preguntan cuál les queda, pedir altura y peso; hasta 1,65 y 65
kilos, S; hasta 1,75 y 80 kilos, M; más, L o XL. Se lava a máquina en
frío; no achica. Cambio sin cargo dentro de los 30 días con la prenda sin
uso. Si preguntan si es la misma que la de la foto de Instagram: sí. Si
preguntan por talles de niño: no hay, derivar si insisten.
```

Lo que tiene una buena ficha:

- **Las tres preguntas típicas** de ese producto, con su respuesta.
- **Cómo elegir** (talle, modelo, variante), con una regla concreta.
- **Lo que no hay** o no se hace, para que el bot no lo invente.
- **Cuándo derivar** por algo específico de ese producto.
- Frases cortas. Sin marketing.

Para un servicio (una consulta, una clase, un turno), la ficha dice:
cuánto dura, qué hay que traer o saber antes, para quién es y para quién
no, y qué pasa después.

---

## 5. Cómo probar antes de conectar

En Probar el bot, estas diez, en este orden. Las últimas dos son las que
el bot NO tiene que saber contestar: la respuesta correcta es "no lo sé,
lo averiguo" o derivar.

1. "Hola, ¿qué venden?"
2. "¿Cuánto sale [el producto más pedido]?"
3. "¿Hacen envíos a [una zona que sí cubren]?"
4. "¿Y a [una zona que no cubren]?"
5. "¿Están abiertos el sábado?"
6. "¿Me hacés un descuento?"
7. "Quiero [dos unidades de algo]. Me llamo [nombre], envialo a [dirección]."
   Y después: "Sí, dale." → tiene que anotar el pedido sin decir "listo".
8. "Ya te transferí." → tiene que derivar por verificar pago.
9. "¿Tienen [algo que no está en el catálogo]?"
10. "¿Cuánto tarda en llegar exacto?" → no promete un día si no está en los
    datos.

Después de cada respuesta rara: "Lo que lee la IA" muestra el prompt
completo. Casi siempre falta un dato o sobra una frase ambigua.

---

## 6. Errores comunes

- **"Sé amable y profesional."** No dice nada. Decir en cambio cómo habla el
  dueño: "directa, sin vueltas, tutea, un emoji cada tanto".
- **Poner el catálogo en el prompt.** Se desactualiza al segundo día y el
  bot cotiza precios viejos. El catálogo está para eso.
- **Reglas en condicional.** "Tratá de no prometer plazos" se ignora. "Nunca
  prometas un plazo" se cumple.
- **Pedir que explique mucho.** Sale un muro de texto. El bot ya está
  limitado a tres burbujas; el prompt tiene que pedir lo contrario.
- **Motivos de derivación sin situación.** "Queja" solo no alcanza; hay que
  decir qué es una queja para este negocio.
- **Cerrar sin datos.** Un pedido sin dirección o sin forma de pago es un
  pedido que el equipo tiene que volver a preguntar. La sección "Cómo
  cerrar" lista lo que hace falta antes de anotar.
- **Hablar del formato.** El JSON, los ids del catálogo, la fecha: eso lo
  agrega el código. Si el prompt lo repite, se contradice con lo que el
  sistema pone abajo.

---

## 7. La lista antes de darlo por terminado

- [ ] Quién sos: nombre, tono, vos/tú/usted, emojis, qué dice si le
      preguntan si es un bot.
- [ ] Datos del negocio: horario, dirección, pagos, envíos, políticas.
- [ ] Reglas con "Nunca".
- [ ] Cada motivo de derivación de Ajustes con su situación.
- [ ] Qué datos pide antes de anotar, y qué dice cuando anota.
- [ ] Seguimientos: cadencia decidida (o ninguno).
- [ ] Cada producto con ficha: tres preguntas típicas, cómo elegir, qué no
      hay.
- [ ] Las diez preguntas pasadas, incluidas las dos que tiene que no saber.
