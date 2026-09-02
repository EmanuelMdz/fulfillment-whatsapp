# Fulfillment WhatsApp

Atención y ventas por WhatsApp con IA. El bot conversa, junta los datos, arma el
pedido y le pasa la conversación a una persona cuando hace falta.

Un repo, un deploy, una URL. Los módulos se prenden y se apagan desde el panel.
Las claves, los prompts y toda la configuración también: **fuera del panel
solo viven tres variables**, las de conexión a la base.

## Dos packs

| | Ecommerce | Servicios |
|---|---|---|
| Contacto | Cliente | Paciente |
| Catálogo | Producto | Prestación |
| Pedido | Venta | Consulta |
| Inventario | Sí | No |

Es el mismo sistema. Lo que cambia son tres listas guardadas en la base: cómo se
llama cada cosa, por qué estados pasa un pedido y por qué motivos la IA deriva a
una persona.

## Arranque

En tu computadora:

```bash
npm install
npm run setup      # deja listo el .env con las tres variables de Supabase
npm run build      # compila el panel dentro del servidor
npm run dev        # servidor en http://localhost:3000
```

Abrí http://localhost:3000. Si la base está vacía, el panel muestra el
**asistente de instalación**: pegás un SQL en Supabase, elegís el pack, creás
tu usuario. Después, desde el panel: Conexión (WhatsApp) y Studio (la IA).

Para ponerlo en línea, `docs/DEPLOY.md`: Railway con tres variables, y el
mismo asistente.

`npm run dev:panel` levanta el panel aparte con recarga en caliente, para
desarrollarlo.

## Estructura

```
apps/
  bot/         servidor: webhook, API, crons, instalador, y sirve el panel compilado
  panel/       React + Vite → se compila en apps/bot/public
packages/
  core/        módulos, packs, catálogo de ejemplo y los valores por defecto
  db/          migraciones
scripts/       arranque local y el SQL para pegar a mano
modules/       lo opcional: cobros, envíos, imágenes, audios, horarios, equipo
docs/          el plan, el porteo, las decisiones, la auditoría y el temario
```

## Qué necesita para correr

- Un proyecto de Supabase (uno por instalación)
- Una cuenta de Railway con dos servicios: el bot y el puente de WhatsApp
  (WAHA). **No sirve serverless ni un plan que duerma el servicio**: el bot
  necesita proceso vivo para la cola de envío y los crons. Entre diez y quince
  dólares por mes por instalación. Paso a paso en `docs/DEPLOY.md`
- Una clave de un proveedor de modelos de IA (Gemini tiene capa gratis)
- Un número de WhatsApp dedicado, nunca el personal

## Documentación

- `docs/DEPLOY.md` — poner el sistema en línea, paso a paso
- `docs/PLAN.md` — el plan completo y las tres tandas
- `docs/PORTEO.md` — qué se trae, de dónde, y en qué estado
- `docs/DECISIONES.md` — por qué está armado así
- `docs/AUDITORIA.md` — la auditoría del 1 de setiembre y lo que se arregló
- `docs/TEMARIO.md` — el mapa de módulos a clases
