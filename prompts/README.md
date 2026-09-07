# El prompt del bot

`negocio.md` es el prompt del bot: un solo texto en markdown, lo que el
modelo recibe como texto de sistema. Abajo de esto, el código agrega solo
lo mecánico (la fecha, el catálogo, los motivos de derivación, el formato
de respuesta).

**Lo escribe Claude, no el alumno.** El flujo:

1. El alumno le pide a Claude: *"escribime el prompt de mi cliente"* y le
   cuenta el negocio.
2. Claude pregunta lo que falte (nombre, qué vende, cómo habla el dueño,
   qué no puede decir, cuándo deriva), escribe este archivo siguiendo
   `docs/PROMPTS.md`, y lo sube con `npm run prompt:push`.
3. El alumno lo ve en Studio, lo prueba en "Probar el bot", y si quiere lo
   retoca ahí mismo. Para traer al archivo lo que se retocó en Studio:
   `npm run prompt:pull`.

La base es la fuente de verdad (es lo que lee el bot). Este archivo es la
copia de trabajo, y se versiona con el resto del repo del alumno.

El que está acá es el de fábrica: genérico a propósito. Sirve para que el
bot funcione el primer día; no para atender un cliente real.
