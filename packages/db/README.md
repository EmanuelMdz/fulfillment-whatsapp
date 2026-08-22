# Base de datos

Una instalación es un negocio y una base. No hay `tenant_id` en ningún lado, y es
a propósito: ver `docs/DECISIONES.md`.

## Cómo se aplica

```bash
npm run setup     # corre las migraciones en orden y siembra según el pack
```

Manualmente, en el editor SQL de Supabase, en orden numérico.

## Migraciones

| Archivo | Qué trae |
|---|---|
| `0001_core.sql` | Configuración, módulos, contactos, catálogo, pedidos |
| `0002_bot.sql` | Conversaciones, mensajes, cola de envío, prompts, episodios de aviso |

Numeración única y correlativa. Nunca se edita una migración ya aplicada: se
agrega la siguiente.

## Las tres listas

`app_config` guarda el diccionario de palabras, los estados del pedido y los
motivos de derivación. Son datos, no código, y son lo que hace que el mismo
sistema se sienta nativo en una tienda y en una clínica.

Los valores por defecto de cada pack viven en `packages/core/src/index.js`. El
instalador los lee de ahí y los escribe en la base **una sola vez**. Después de
eso la fuente de verdad es la base: tocar el archivo de core no cambia una
instalación que ya corrió.

## Semillas

`seeds/` tiene solo contenido de ejemplo — un puñado de productos o prestaciones
para que el bot tenga de qué hablar el primer día. Se borran sin miedo.
