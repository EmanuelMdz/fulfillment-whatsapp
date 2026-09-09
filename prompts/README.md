# El prompt del agente

`negocio.md` es la copia de trabajo del único prompt editable de Studio.
Ahí se define objetivo, información, links, datos del lead, derivación y seguimientos.

La base es la fuente de verdad:
- `npm run prompt:pull` trae el texto de Studio.
- `npm run prompt:push` reemplaza Studio por el archivo.

Para escribirlo, usá [PROMPTS.md](../docs/PROMPTS.md).
El prompt inicial es neutro y no programa seguimientos hasta que el dueño
defina su cadencia. Cambiar el archivo local no cambia una instalación remota.
