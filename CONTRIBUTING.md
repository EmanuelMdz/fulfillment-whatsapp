# Desarrollar y proponer cambios

Leé [README.md](README.md), [CLAUDE.md](CLAUDE.md) y
[docs/DECISIONES.md](docs/DECISIONES.md). Para adaptar un negocio empezá por
el panel y [docs/GUIA.md](docs/GUIA.md).

## Entorno y verificación

Usá Node 24 LTS. `npm ci` respeta el lockfile. Trabajá con una base de prueba;
no ejecutes trabajadores locales contra una instalación desplegada.

```bash
npm ci
npm run check
```

`check` ejecuta tests, TypeScript y build. Los tests reemplazan las credenciales
y bloquean la red; usan APIs simuladas y Postgres en memoria (PGlite). No
necesitan Docker, un Supabase local ni claves de IA. En el test SQL se emulan
los roles de Supabase y `auth.jwt`; no se verifica su infraestructura de Auth
y se omite la extensión pgcrypto, usando el UUID nativo de Postgres.

GitHub Actions repite los controles en Windows y Linux. Esto no reemplaza las
[pruebas reales de entrega](docs/PRUEBAS.md), incluidas reconexión y reinicios.

## Dónde cambiar cada cosa

| Necesidad | Lugar |
|---|---|
| Comportamiento de una respuesta | `apps/bot/src/workers/turns.ts` y `agents/` |
| Entrada, deduplicación y agenda | `routes/webhook.ts` y migración `0015` |
| Integración WAHA | `providers/waha.ts` |
| Ritmo de envío | `workers/send-queue.ts`; conservar cola única y pausas |
| Panel | `apps/panel/src/pages/`; componentes en `src/ui/` |
| Valores iniciales y extensiones históricas | `packages/core/src/` |
| Base | Nueva migración numerada en `packages/db/migrations/` |

Nunca edites una migración ya aplicada. Los generadores de SQL del servidor y
la terminal comparten el registro: una migración y su marca se confirman juntas;
repetir el paquete omite lo aplicado. Toda tabla nueva tiene RLS y todo RPC
administrativo debe quedar restringido a `service_role`.

## Antes de proponer una versión

- Ejecutá `npm run check` y `npm audit`.
- Revisá `git diff` y los archivos nuevos; no agregues `.env`, sesiones o respaldos.
- Documentá un cambio de comportamiento en las guías que lo explican.
- Indicá qué probaste y qué necesita una cuenta o un teléfono para verificarse.
- Coordiná publicación y licencia con el autor; no asumas permisos comerciales.

La revisión se hace sobre una copia limpia también: así se detecta si falta
un archivo que existía en la computadora del autor pero no está en Git.
