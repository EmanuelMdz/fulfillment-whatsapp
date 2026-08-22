# Fulfillment WhatsApp

Atención y ventas por WhatsApp con IA. El bot conversa, junta los datos, arma el
pedido y le pasa la conversación a una persona cuando hace falta.

Un repo, un deploy, una URL. Los módulos se prenden y se apagan desde el panel.

> **Estado: en construcción.** Existe el esqueleto y el diseño. El porteo del
> bot y del panel arranca con la tanda 1 — ver `docs/PLAN.md`.

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

```bash
npm install
npm run setup      # crea el .env y te guía
npm run dev        # servidor en http://localhost:3000
npm run dev:panel  # panel con recarga en caliente, aparte
```

Para producción:

```bash
npm run build      # compila el panel dentro del servidor
npm start
```

## Estructura

```
apps/
  bot/         servidor: webhook, API, crons, y sirve el panel compilado
  panel/       React + Vite → se compila en apps/bot/public
packages/
  core/        módulos, packs y los valores por defecto de cada uno
  db/          migraciones y semillas
modules/       lo opcional: cobros, envíos, imágenes, audios, horarios, equipo
docs/          el plan, el porteo, las decisiones y el temario
```

## Qué necesita para correr

- Un proyecto de Supabase (uno por instalación)
- Un servidor Node siempre encendido — **no sirve serverless**, el bot necesita
  proceso vivo para la cola de envío y los crons
- Un puente de WhatsApp con su URL y su clave
- Una clave de un proveedor de modelos de IA
- Un número de WhatsApp dedicado, nunca el personal

## Documentación

- `docs/PLAN.md` — el plan completo y las tres tandas
- `docs/PORTEO.md` — qué se trae, de dónde, y en qué estado
- `docs/DECISIONES.md` — por qué está armado así
- `docs/TEMARIO.md` — el mapa de módulos a clases
