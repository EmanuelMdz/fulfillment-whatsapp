# Fulfillment · Ainnovate

Un asistente de atención por WhatsApp que consulta tu catálogo, reúne datos,
anota pedidos y deriva a una persona. Incluye el bot y un panel para configurar
el negocio, probar la IA y atender conversaciones.

**Tu primer resultado:** instalar el panel y probar una conversación con tu
catálogo, antes de vincular un número. Después, conectar WhatsApp en modo
prueba y verificar el circuito completo.

**Empezá por [PRIMEROS_PASOS.md](docs/PRIMEROS_PASOS.md).** Está escrito para
alguien que duplica el repo por primera vez, con o sin ayuda de una IA.

## Qué incluye hoy

- Conexión por QR mediante WAHA; mensajes de texto y toma de control humana.
- Catálogo, ficha del contacto, pedidos pendientes de confirmación y revisión.
- Un prompt editable, simulador de conversación y prueba de seguimientos.
- Avisos al equipo, métricas, usuarios y modo prueba con números autorizados.
- Instalador web y migraciones automáticas con Supabase.

| Punto de partida | Palabras y etapas iniciales |
|---|---|
| General | Clientes, catálogo, pedidos |
| Ecommerce | Clientes, productos, ventas |
| Servicios | Pacientes, prestaciones, consultas |

Los tres usan el mismo código. Los nombres, estados y motivos se cambian desde
Ajustes. **Inventario, cobros, transcripción de audios, interpretación de fotos,
envíos, horarios por franja y asignación de casos todavía no están implementados.**
El pack Servicios registra solicitudes; no incluye una agenda con disponibilidad.
Un pedido anotado necesita confirmación humana.

## Qué necesitás

| Para qué | Requisito |
|---|---|
| Guardar datos y entrar al panel | Un proyecto nuevo de Supabase por negocio |
| Probar la IA | Una clave propia de Gemini u OpenAI con acceso al modelo elegido |
| Publicar | GitHub y Railway; bot siempre encendido, una sola réplica |
| Vincular WhatsApp | Servicio WAHA con volumen persistente y un número dedicado |
| Trabajar en tu computadora | Git y Node.js **24 LTS**, con npm |

El costo de operar el sistema depende de hosting, IA y número: consultá
[DEPLOY.md](docs/DEPLOY.md). WAHA es un puente no oficial y puede perder la
sesión o sufrir bloqueos; las pausas no garantizan que el número quede protegido.

## Elegí un recorrido

**Sin terminal:** duplicá el repo en GitHub y seguí [el despliegue en Railway](docs/DEPLOY.md).

**En tu computadora:** abrí una terminal en tu copia del repo y ejecutá uno por uno:

```bash
npm ci
npm run setup
npm run build
npm run doctor
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). El asistente crea el negocio
y tu usuario. Necesitás la URL del proyecto de Supabase y su token de acceso;
la guía explica dónde encontrarlos y el [modo sin token de cuenta](docs/DEPLOY.md#modo-manual-sin-token-de-cuenta).

El bot empieza **en modo prueba**, sin números autorizados. Primero Studio →
clave y prompt; luego Catálogo → tus fichas; después Probar el bot. Para usar
WhatsApp seguí [Conectar y probar](docs/PRUEBAS.md).

No ejecutes el bot local y el desplegado contra la misma base al mismo tiempo:
serían dos trabajadores enviando mensajes. Usá un proyecto de aprendizaje aparte.

## Comandos útiles

| Comando | Resultado |
|---|---|
| `npm run doctor` | Diagnóstico local de Node, variables y build; no contacta cuentas ni imprime claves |
| `npm run check` | Tests aislados, TypeScript y compilación del panel y servidor |
| `npm run dev:panel` | Panel con recarga; requiere el bot en localhost:3000 |
| `npm run demo` | Cinco conversaciones ficticias en una base de aprendizaje ya instalada |
| `npm run demo:limpiar` | Quita exclusivamente la demo nueva marcada |
| `npm run prompt:pull` | Copia el prompt de Studio a `prompts/negocio.md` |
| `npm run prompt:push` | Reemplaza el prompt de Studio por el archivo local |
| `npm run db:sql` | Muestra las migraciones; para guardarlas sin texto de npm: `node scripts/db-sql.mjs > instalar.sql` |

La demo visual no necesita WAHA ni IA, pero sí Supabase y haber terminado el
asistente. Sus chats no envían mensajes y sus seguimientos quedan cancelados.

## Documentación

1. [Primeros pasos](docs/PRIMEROS_PASOS.md): de duplicar el repo a la primera prueba.
2. [Deploy](docs/DEPLOY.md): cuentas, variables, volumen y conexión.
3. [Adaptar un negocio](docs/GUIA.md) y [escribir su prompt](docs/PROMPTS.md).
4. [Pruebas de entrega](docs/PRUEBAS.md): verificaciones con teléfonos reales.
5. [Operación y recuperación](docs/OPERACION.md): actualizar, respaldar y resolver problemas.
6. [Desarrollar](CONTRIBUTING.md): arquitectura y controles del repo.

Para el autor: [estado de lanzamiento y pendientes](docs/LANZAMIENTO.md).
[PLAN](docs/PLAN.md), [PORTEO](docs/PORTEO.md), [AUDITORIA](docs/AUDITORIA.md) y
[TEMARIO](docs/TEMARIO.md) conservan contexto histórico; no son instrucciones
de instalación ni una promesa de funciones disponibles.

## Estructura

```text
apps/bot/       API Hono + TypeScript, instalador, webhooks y trabajadores
apps/panel/     React + Vite + Tailwind; compila dentro de apps/bot/public
packages/core/  packs, catálogo de ejemplo y utilidades compartidas
packages/db/    migraciones de Postgres
scripts/        instalación local, diagnóstico, demo y prompts
tests/          pruebas sin credenciales; Postgres en memoria y APIs simuladas
docs/           guías para instalar, adaptar y operar
```

Una instalación es un negocio: una base, un bot y un puente. El panel y la API
se publican juntos; WAHA es el segundo servicio del proyecto de Railway.
