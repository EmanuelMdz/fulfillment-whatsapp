# Fulfillment WhatsApp — reglas del repo

> Un bot de atención y ventas por WhatsApp con IA, hecho por Ainnovate para
> que sus alumnos lo instalen, lo conecten a un negocio real y lo adapten
> con Claude. Lo lee gente que recién empieza, así que el código se escribe
> para ser leído.

## Para quién estás trabajando

Este archivo lo lee Claude en dos situaciones distintas:

- **Un alumno adaptando el bot a un cliente.** Es lo más común. Antes de
  contestar, leé `docs/GUIA.md` (qué hacer en cada caso) y `docs/PROMPTS.md`
  (cómo escribir prompts que atienden bien). Casi todo se resuelve desde el
  panel, sin tocar código: proponé eso primero. Hablá desde Ainnovate:
  *"En Ainnovate recomendamos…"*, con el porqué. El alumno está aprendiendo
  a vender esto, y la explicación es parte del producto.
- **Alguien desarrollando el producto.** Las reglas de abajo mandan.

En los dos casos: el alumno describe la situación del cliente, no la
solución técnica. Si pide "agregá un if", preguntá qué quiere que pase con
el cliente y resolvelo por donde corresponda.

### El prompt lo escribís vos, no el alumno

Cuando el alumno pide el prompt de su cliente (o cuando conecta un negocio
nuevo), el flujo es este:

1. Preguntá lo que falte, en una sola tanda: nombre del negocio, qué vende
   o hace, cómo habla el dueño (vos, tú, usted; emojis o no), horario,
   dirección, formas de pago, envíos o retiro, políticas que se preguntan
   seguido, qué no puede decir el bot, y en qué situaciones tiene que pasar
   a una persona.
2. Escribí `prompts/negocio.md` siguiendo la plantilla y los principios de
   `docs/PROMPTS.md`. Un solo texto en markdown con sus secciones. Lo que
   se vende NO va ahí: va al catálogo (si el alumno te pasa productos,
   ofrecé cargarlos con sus fichas).
3. Subilo con `npm run prompt:push`. Aparece en Studio; el bot lo usa desde
   el próximo mensaje.
4. Decile al alumno que lo lea en Studio, que pase las diez preguntas de
   `docs/PROMPTS.md` en Probar el bot, y que te cuente qué contestó mal.
   Iterá desde el archivo. Si retocó algo en Studio, `npm run prompt:pull`
   antes de seguir.

Los motivos de derivación que uses en la sección "Cuándo derivar" tienen
que existir en Ajustes → Motivos (los del pack General: pedir_humano,
queja, urgencia, sin_avance, no_supo). Si el negocio necesita otro,
agregalo ahí primero.

## Reglas no negociables

### 1. Nada de Argos entra acá
El producto se extrajo de un sistema real, pero **no es ese sistema**: ni el
nombre, ni los prompts afinados, ni datos de clientes reales, ni la
documentación interna de los repos de origen. Cuando se portea un archivo,
se limpia. Los prompts genéricos que van acá son otros, escritos de cero.

### 2. Un solo deploy
El panel se compila dentro del servidor (`apps/panel` → `apps/bot/public`) y
sale por el mismo origen. **No agregar un segundo servicio**, ni mover el
panel a otro hosting, ni introducir CORS. Cada servicio extra es un mensaje
de soporte multiplicado por cada alumno.

Y el servidor necesita proceso vivo: cola de envío uno por uno, espera antes
de contestar, crons. Nada de esto sobrevive en funciones serverless.

### 3. Los módulos se prenden y se apagan, nunca se borran
Todo lo opcional pasa por la tabla `modules` y por `MODULES` en
`packages/core`. Nada de instrucciones del tipo "borrá la carpeta que no
uses". Ningún módulo puede depender de otro: si dos se necesitan, eso que
comparten va al núcleo. Un módulo sin código lleva `available: false` y el
panel lo muestra como "próximamente".

### 4. Las tres listas viven en la base, y el prompt es uno
El diccionario de palabras, los estados del pedido y los motivos de
derivación están en `app_config`, editables desde Ajustes. **Nunca escribir
"Venta" fijo en un componente**: en una clínica se llama consulta. Nada de
enums en Postgres ni de `if (estado === 'entregado')` desparramado.

El prompt del bot es **un solo texto en markdown** (fila `sistema` de la
tabla `prompts`), tal como un modelo recibe su texto de sistema. El código
le agrega abajo lo mecánico (fecha, catálogo, motivos, formato) en
`agents/context.ts`. No se vuelve a partir en cajas ni se agregan
"mensajes fijos": lo que le llega al cliente lo escribe el modelo con la
voz del negocio.

### 5. Interfaz sin emojis, y con el sistema de diseño
Íconos de `lucide-react`. Los emojis solo pueden aparecer dentro del
contenido de un mensaje de WhatsApp, que es texto del negocio, no interfaz.

Única excepción: `ui/WhatsappIcon.jsx`, el glifo del canal, para las
pantallas donde el tema ES WhatsApp. Va **monocromo**, heredando el color
del texto: identifica el canal, no anuncia un convenio con Meta. El
puente es no oficial, así que **nunca** el logo a todo color, ni el
nombre de WhatsApp en el título del producto, ni nada que sugiera que es
oficial.

Todo lo visual sale de dos lugares: los tokens en `apps/panel/src/styles.css`
(colores, radios, sombras, tipografía, en `@theme` de Tailwind 4) y los
componentes en `apps/panel/src/ui/` (`Card`, `Button`, `Badge`, `Field`,
`Table`, `Kpi`, `AreaTrend`, `PageHeader`, `Notice`, `EmptyState`). Una
pantalla nueva se arma combinando esos componentes; **nada de colores ni
tamaños sueltos en las páginas**. Si hace falta algo que no existe, se
agrega al sistema, no a la página. Los gráficos van con Recharts.

### 6. Mobile sin scroll lateral
Toda tabla se convierte en tarjetas en pantalla chica (el componente
`Table` lo hace solo). Nunca resolver una tabla nueva con `overflow-x`
horizontal en el cuerpo de la página.

### 7. Una instalación es un negocio
No hay `tenant_id` y no se agrega. Un alumno, un Supabase, un deploy. Dos
clientes son dos instalaciones.

### 8. Migraciones
Archivo nuevo con el número que sigue, en `packages/db/migrations`. **Nunca
se edita una migración ya aplicada.** Toda tabla nueva arranca con RLS
prendida y su política (o sin política a propósito, como `app_secrets`).

### 9. Antes de pushear
`npm run check` (type-check + build) tiene que pasar. Nunca pushear sin
confirmación de Emanuel.

### 10. Esto es material didáctico
El comentario explica **por qué**, no qué. Si algo está resuelto de una forma
rara porque atrás hay un problema real, se escribe el problema: ese
comentario es media clase. Nombres de variables y de tablas en inglés;
comentarios, interfaz y documentación en español.

### 11. Todo se configura desde el panel
Fuera del panel viven **dos variables**: `SUPABASE_URL` y
`SUPABASE_ACCESS_TOKEN` (el token de cuenta `sbp_…`; con él el servidor busca
las claves, crea las tablas y apaga los registros, `config/supabase-admin.ts`).
Claves de IA, puente de WhatsApp, prompts, tiempos: todo va a `app_config` o
`app_secrets` con su pantalla. Una variable de entorno nueva se justifica por
escrito en `DECISIONES.md`. Las claves guardadas nunca vuelven enteras al
navegador: solo si están cargadas y sus últimos caracteres
(`config/settings.ts`). El modo sin token (las dos claves del proyecto y el
SQL pegado a mano) tiene que seguir funcionando, pero es el secundario.

### 12. Lo que protege al número no se toca
La cola de envío con sus pausas, la única réplica, el secreto del webhook,
las policies de `0008_equipo.sql`. Ningún pedido de "que conteste más
rápido" justifica acelerar la cola. Está explicado en `docs/GUIA.md`,
sección 5.

## Cuando un alumno pide un cambio: el mapa corto

La versión completa, caso por caso, está en `docs/GUIA.md`. Lo que más se
pide:

| Pide… | Va en… |
|---|---|
| Otro tono, otra forma de hablar | Studio → Prompt, sección "Quién sos" |
| Horarios, dirección, pagos, envíos, políticas | Studio → Prompt, "Datos del negocio" |
| Que sepa de lo que vende | Catálogo → "Lo que la IA sabe" |
| Que no diga o no prometa algo | Studio → Prompt, "Reglas", con "Nunca" |
| Que derive a una persona cuando… | Ajustes → Motivos + Prompt, "Cuándo derivar" |
| Renombrar pedidos, cambiar etapas | Ajustes → Diccionario y Estados |
| Recordatorios distintos o ninguno | Studio → Prompt, "Seguimientos"; Ajustes → ventana nocturna |
| Que conteste más rápido | Ajustes → Avanzado, espera antes de contestar (no menos de 30) |
| Probar con el número real sin contestarle a clientes | Conexión → Modo prueba (`config/test-mode.ts`) |
| Horarios, stock, pagos, fotos, audios | Módulos de la Tanda 3, todavía sin código; qué hacer mientras tanto está en la guía |
| Un campo nuevo, un aviso nuevo, un comportamiento nuevo | Código, con las reglas de arriba |

## Dónde vive qué

| Pieza | Lugar |
|---|---|
| Servidor, webhook, API, crons, instalador | `apps/bot/src/` |
| Configuración leída de la base (antes el .env) | `apps/bot/src/config/settings.ts` |
| Lo que lee el modelo y qué hace con la respuesta | `apps/bot/src/agents/context.ts`, `apps/bot/src/workers/turns.ts` |
| Panel | `apps/panel/src/` |
| Sistema de diseño: tokens y componentes | `apps/panel/src/styles.css` y `apps/panel/src/ui/` |
| Módulos, packs y catálogo de ejemplo | `packages/core/src/` |
| Esquema | `packages/db/migrations/` |
| Lo opcional | `modules/` |
| El prompt del bot (copia de trabajo; la base es la verdad) | `prompts/negocio.md` |
| Guía caso por caso, prompts y pruebas | `docs/GUIA.md`, `docs/PROMPTS.md`, `docs/PRUEBAS.md` |
| La misma guía, adentro del panel (checklist) | `apps/panel/src/pages/PuestaEnMarcha.jsx` |
| Plan, porteo, decisiones, deploy, auditoría, temario | `docs/` |

## Comandos

```bash
npm install
npm run setup        # deja listo el .env local; la instalación la hace el panel
npm run dev          # servidor (crea las tablas al arrancar si faltan)
npm run dev:panel    # panel con recarga en caliente
npm run check        # type-check + build — OBLIGATORIO antes de pushear
npm run db:sql       # las migraciones para pegar en Supabase, por si no se usa el token
npm run prompt:push  # prompts/negocio.md → la base (el prompt del bot)
npm run prompt:pull  # la base → prompts/negocio.md
npm run demo         # cinco conversaciones de ejemplo, para ver el panel lleno
npm run demo:limpiar # las borra
```
