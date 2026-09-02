# Base de datos

Una instalación es un negocio y una base. No hay `tenant_id` en ningún lado, y es
a propósito: ver `docs/DECISIONES.md`.

## Cómo se aplica

El servidor no tiene conexión directa a Postgres (solo la API de Supabase), y
la API no puede crear tablas. Por eso las migraciones se pegan en el editor
SQL de Supabase — un solo paste:

- **Desde el panel**: al abrirlo contra una base vacía aparece el asistente de
  instalación, con el SQL que falta y un botón Copiar. Cuando una
  actualización trae migraciones nuevas, el panel avisa con una franja y el
  mismo botón.
- **Desde la terminal**: `npm run db:sql` imprime todas las migraciones en
  orden, para pegar.

Se puede pegar más de una vez: todo usa `if not exists` / `or replace`, y la
tabla `_migrations` anota lo aplicado para que el asistente sepa qué falta.

## Migraciones

| Archivo | Qué trae |
|---|---|
| `0001_core.sql` | Configuración, módulos, contactos, catálogo, pedidos |
| `0002_bot.sql` | Conversaciones, mensajes, cola de envío, prompts, episodios de aviso |
| `0003_event_log.sql` | Registro de eventos |
| `0004_revision.sql` | Cola de revisión y llave general del bot |
| `0005_seguimientos.sql` | Seguimientos automáticos |
| `0006_panel.sql` | Vista para la lista de conversaciones |
| `0007_settings.sql` | La configuración que antes era el `.env`: modelo, puente, tiempos; la tabla de claves; los dos mensajes fijos |
| `0008_equipo.sql` | `team_members` y las policies que solo dejan entrar al equipo |
| `0009_robustez.sql` | Reclamar envíos y turnos que murieron con un reinicio; limpieza del registro |
| `0010_instalador.sql` | El código de instalación del asistente |

Numeración única y correlativa. Nunca se edita una migración ya aplicada: se
agrega la siguiente. Toda tabla nueva arranca con RLS prendida — y con su
política, salvo que la falta de política sea la decisión (como en
`app_secrets`, que solo lee el servidor).

## Las tres listas

`app_config` guarda el diccionario de palabras, los estados del pedido y los
motivos de derivación. Son datos, no código, y son lo que hace que el mismo
sistema se sienta nativo en una tienda y en una clínica.

Los valores por defecto de cada pack viven en `packages/core/src/index.js`. El
asistente de instalación los lee de ahí y los escribe en la base **una sola
vez**. Después de eso la fuente de verdad es la base: tocar el archivo de core
no cambia una instalación que ya corrió.

## Catálogo de ejemplo

Vive en `packages/core/src/seeds.js` (filas, no SQL: el servidor las inserta
por la API). Un puñado de productos o prestaciones para que el bot tenga de
qué hablar el primer día. Se borran sin miedo desde el panel.
