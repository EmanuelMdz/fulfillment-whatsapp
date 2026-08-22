# Fulfillment WhatsApp — reglas del repo

> Producto para la academia. Se extrae de Argos, pero **no es Argos**: acá no
> entra nada de ese negocio. Lo lee gente que recién empieza, así que el código
> se escribe para ser leído.

## Reglas no negociables

### 1. Nada de Argos entra acá
Ni el nombre, ni los prompts afinados, ni datos de clientes reales, ni la
documentación interna de los dos repos de origen (está llena de incidentes y de
números de teléfono). Cuando se portea un archivo, se limpia: cadetería, DAC,
Montevideo, combos, márgenes y atribución de anuncios se quedan afuera.

Los prompts genéricos que van acá son otros, escritos de cero. Los de Argos son
el activo y no se regalan.

### 2. Un solo deploy
El panel se compila dentro del servidor (`apps/panel` → `apps/bot/public`) y sale
por el mismo origen. **No agregar un segundo servicio**, ni mover el panel a otro
hosting, ni introducir CORS. Cada servicio extra es un mensaje de soporte
multiplicado por cada alumno.

Y el servidor necesita proceso vivo: cola de envío uno por uno, espera antes de
contestar, crons. Nada de esto sobrevive en funciones serverless.

### 3. Los módulos se prenden y se apagan, nunca se borran
Todo lo opcional pasa por la tabla `modules` y por `MODULES` en
`packages/core`. Nada de instrucciones del tipo "borrá la carpeta que no uses".

Ningún módulo puede depender de otro. Si dos se necesitan, eso que comparten va
al núcleo.

### 4. Las tres listas viven en la base
El diccionario de palabras, los estados del pedido y los motivos de derivación
están en `app_config`, editables desde el panel. **Nunca escribir "Venta" fijo en
un componente**: en una clínica se llama consulta. Se pide con `label(pack, key)`.

Lo mismo con los estados: nada de enums en Postgres ni de `if (estado ===
'entregado')` desparramado. Los estados salen de la configuración.

### 5. Interfaz sin emojis
Íconos de `lucide-react`. Los emojis solo pueden aparecer dentro del contenido de
un mensaje de WhatsApp — que es texto del negocio, no interfaz.

### 6. Mobile sin scroll lateral
Toda tabla se convierte en tarjetas en pantalla chica. Nunca resolver una tabla
nueva con `overflow-x` horizontal en el cuerpo de la página.

### 7. Una instalación es un negocio
No hay `tenant_id` y no se agrega. Un alumno, un Supabase, un deploy. Si algún
día hace falta multi-negocio, es otro producto y otra decisión.

### 8. Migraciones
Archivo nuevo con el número que sigue, en `packages/db/migrations`. **Nunca se
edita una migración ya aplicada.** Toda tabla nueva arranca con RLS prendida y su
política.

### 9. Antes de pushear
`npm run build` tiene que pasar. Nunca pushear sin confirmación de Emanuel.

### 10. Esto es material didáctico
El comentario explica **por qué**, no qué. Si algo está resuelto de una forma
rara porque atrás hay un problema real, se escribe el problema — ese comentario
es media clase.

Nombres de variables y de tablas en inglés; comentarios, interfaz y
documentación en español.

## Dónde vive qué

| Pieza | Lugar |
|---|---|
| Servidor, webhook, API, crons | `apps/bot/src/` |
| Panel | `apps/panel/src/` |
| Módulos y packs por defecto | `packages/core/src/index.js` |
| Esquema | `packages/db/migrations/` |
| Lo opcional | `modules/` |
| Plan, porteo, decisiones, temario | `docs/` |

## Comandos

```bash
npm install
npm run setup        # instalador
npm run dev          # servidor
npm run dev:panel    # panel con recarga en caliente
npm run build        # OBLIGATORIO antes de pushear
npm run type-check
```
