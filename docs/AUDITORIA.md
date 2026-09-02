# Auditoría del repo — 1 de setiembre de 2026

Objetivo de la auditoría: que un alumno pueda **copiar, pegar y tener el bot
andando en un negocio mañana**, sin tocar un archivo de texto ni entrar a
configurar variables en el hosting. Todo lo configurable tiene que vivir en el
panel.

Cada hallazgo trae: qué pasa hoy, dónde (archivo y línea), qué cuesta si no se
arregla, y la solución lista para pegar. Las severidades:

| Tag | Qué significa |
|---|---|
| **[ALTA]** | Hoy rompe el producto o expone datos. Va primero. |
| **[MEDIA]** | Un alumno se traba o el bot falla en un caso que va a pasar. |
| **[BAJA]** | Prolijidad, deuda o docs. Se hace cuando se pueda. |

Estado al momento de auditar: `npm run build` y `npm run type-check` pasan.
Hay cambios sin commitear (Tanda 3: módulos, menú dinámico, Ajustes, carga
del `.env`, arreglo de la migración 0001) — se commitean antes de tocar nada
de esto.

> **Actualización, 1 de setiembre de 2026 (mismo día):** las cuatro tandas
> del punto 7 quedaron implementadas (migraciones 0007 a 0010,
> `config/settings.ts`, asistente de instalación, pantallas de claves,
> usuarios, grupo de avisos, prueba de contexto y seguimientos, y las
> catorce fallas del punto 4). Lo que sigue abajo es el diagnóstico tal como
> se escribió; sirve para entender el porqué de cada cambio. Lo único que
> queda por verificar con un número conectado es la 4.2 (la carrera del eco).
>
> **Un cambio sobre el punto 1 y el 2, decidido después:** el entorno quedó
> en **dos** variables, no tres: `SUPABASE_URL` y `SUPABASE_ACCESS_TOKEN`.
> Con el token de la cuenta el servidor busca las claves del proyecto, crea
> las tablas al arrancar y apaga los registros abiertos; el paste de SQL
> quedó como alternativa para quien no quiera dar el token. Ver la decisión
> 9 en `DECISIONES.md`.

---

## 0. Resumen ejecutivo

Lo que hay funciona y está bien pensado: cola única de envío, turnos en la
base, toma de control humana, decisión en JSON con guardas, avisos
idempotentes, tres listas en la base. El código es legible y explica el porqué.

Lo que falta para "copiar y pegar y que ande":

1. **La configuración vive en el `.env`** — claves de IA, URL y clave de WAHA,
   URL pública, tiempos. Hay que dejar el entorno en **tres variables** (las de
   Supabase) y mover todo lo demás al panel. Es el punto 1 de este documento.
2. **El instalador pide la URI de Postgres con contraseña.** Un alumno se traba
   ahí. La instalación tiene que ser un asistente en el panel: pegar un SQL en
   Supabase, completar tres campos, listo. Punto 2.
3. **Cuatro fallas [ALTA] en el código** que hoy hacen que el bot no ande o
   que exponen datos: los mensajes de grupo entran como conversaciones (el bot
   le contesta al grupo de avisos), el eco del propio mensaje puede pausar al
   bot, el webhook sin secreto deja que cualquiera mande mensajes desde el
   número, y **cualquier persona que se registre en Supabase ve toda la base**.
   Punto 4.
4. **WAHA**: desde la versión 2026.6.1 todo es gratis (sesiones ilimitadas,
   multimedia, almacenamiento). Cada alumno levanta su propia instancia en
   Railway, en el mismo proyecto que el bot. Punto 3.
5. **Prompts y prueba**: hay dos textos con voz del negocio escritos en el
   código, la ventana nocturna es fija, no se puede ver qué lee la IA, no hay
   pantalla de usuarios y el grupo de avisos hay que escribirlo a mano con su
   id interno. Punto 5.

Orden de ejecución propuesto al final (punto 7).

---

## 1. Variables de entorno → el panel

### 1.1 Qué hay hoy

`.env.example` tiene 22 variables. Quién lee cada una y adónde debería ir:

| Variable | La lee | Hoy | Destino |
|---|---|---|---|
| `SUPABASE_URL` | `config/env.ts:78` | obligatoria | **queda** en el entorno |
| `SUPABASE_SERVICE_ROLE_KEY` | `config/env.ts:79` | obligatoria | **queda** en el entorno |
| `SUPABASE_DB_URL` | `scripts/setup.mjs:124` | solo el instalador | desaparece (ver punto 2) |
| `VITE_SUPABASE_URL` | `panel/lib/supabase.js:9` | se hornea en el build | desaparece: el servidor la sirve en `/config.js` |
| `VITE_SUPABASE_ANON_KEY` | `panel/lib/supabase.js:10` | se hornea en el build | pasa a ser `SUPABASE_ANON_KEY`, servida en `/config.js` |
| `LLM_PROVIDER` | `config/env.ts:70` | opcional | `app_config.llm_provider` |
| `LLM_MODEL` | `config/env.ts:91` | opcional | `app_config.llm_model` |
| `GEMINI_API_KEY` | `config/env.ts:92` | opcional | `app_secrets` |
| `OPENAI_API_KEY` | `config/env.ts:93` | opcional | `app_secrets` |
| `WHATSAPP_API_URL` | `config/env.ts:84` | opcional | `app_config.whatsapp_api_url` |
| `WHATSAPP_API_KEY` | `config/env.ts:85` | opcional | `app_secrets` |
| `WHATSAPP_SESSION` | `config/env.ts:86` | opcional | `app_config.whatsapp_session` |
| `WHATSAPP_WEBHOOK_SECRET` | `config/env.ts:87` | opcional | `app_secrets`, **lo genera el servidor solo** |
| `PORT` | `config/env.ts:73` | opcional | queda (Railway la inyecta) |
| `TIMEZONE` | `setup.mjs:172` | valor inicial | ya vive en `app_config.timezone` — se borra |
| `LOG_LEVEL` | `config/env.ts:75` | **se lee y no se usa en ningún lado** | se borra |
| `PUBLIC_URL` | `config/env.ts:76` | opcional | se detecta sola (`RAILWAY_PUBLIC_DOMAIN`) con override en `app_config.public_url` |
| `NOTIFY_CHAT_ID` | `setup.mjs:173` | valor inicial | ya vive en `app_config.notify_chat_id` — se borra |
| `DEBOUNCE_SECONDS` | `config/env.ts:96` | opcional | `app_config.debounce_seconds` |
| `SEND_PAUSE_MIN_MS` / `MAX_MS` | `config/env.ts:100-101` | opcional | `app_config.send_pause_min_ms` / `max_ms` |
| `SEND_TICK_MS` / `TURN_TICK_MS` / `FOLLOWUP_TICK_MS` | `config/env.ts:97-99` | opcional | constantes en el código (nadie debería tocarlas) |

Costo de dejarlo así: cada variable es un lugar donde el alumno puede
equivocarse, y cambiar cualquiera obliga a entrar a Railway y reiniciar. El
panel ya tiene login y ya escribe `app_config` (Studio, Ajustes): es el lugar.

### 1.2 Cómo queda

**Tres variables**, todas de Supabase, todas de la misma pantalla
(Settings → API). Nada más.

`.env.example` nuevo, entero:

```bash
# ─────────────────────────────────────────────────────────────
# Lo ÚNICO que se configura fuera del panel: la conexión a la base.
# Las tres salen de Supabase → Settings → API. Todo lo demás (claves de
# IA, WhatsApp, prompts, tiempos) se carga desde el panel una vez que
# el servidor arranca.
# ─────────────────────────────────────────────────────────────
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Solo en tu computadora. En Railway NO la cargues: la pone Railway.
PORT=3000
```

En Railway se pega en Variables → **Raw Editor** (botón arriba a la derecha
de la pestaña Variables), tal cual:

```
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Regla nueva para `CLAUDE.md` (agregar como regla 11): *"Una variable de
entorno nueva se justifica por escrito en `DECISIONES.md`. Lo que un alumno
tenga que configurar va al panel."*

### 1.3 Migración `0007_settings.sql`

Columnas nuevas en `app_config` para lo que no es secreto, y una tabla aparte
para las claves. La tabla de secretos **no tiene política para
`authenticated` a propósito**: con RLS prendida y sin política, el navegador
no puede leerla ni con sesión. Solo el servidor (clave de servicio) entra.

```sql
-- ============================================================
-- 0007 — Configuración desde el panel
--
-- Antes, las claves de IA, la dirección del puente de WhatsApp y los
-- tiempos del bot vivían en variables de entorno. Cada una era un lugar
-- más donde un alumno se podía equivocar y un reinicio del servidor
-- por cada cambio. Ahora viven acá y se editan desde el panel.
--
-- Dos tablas distintas a propósito:
--   - app_config: lo que NO es secreto (modelo, URL del puente, tiempos).
--     El panel lo lee y lo escribe directo, como el resto de la config.
--   - app_secrets: las claves. Sin política para `authenticated`: el
--     navegador NO puede leerlas ni con sesión. Solo el servidor.
-- ============================================================

alter table public.app_config
  add column if not exists llm_provider      text not null default 'gemini',
  add column if not exists llm_model         text not null default 'gemini-2.5-flash',
  add column if not exists whatsapp_api_url  text not null default '',
  add column if not exists whatsapp_session  text not null default 'default',
  -- Vacío = se detecta sola (RAILWAY_PUBLIC_DOMAIN). Se completa a mano
  -- solo si el hosting no la informa.
  add column if not exists public_url        text not null default '',
  -- Símbolo o código que el panel muestra al lado de los precios.
  add column if not exists currency          text not null default '$',
  -- Cuánto espera el bot antes de contestar, para juntar mensajes sueltos.
  add column if not exists debounce_seconds  int  not null default 90,
  -- Pausa entre envíos. Es lo que protege al número. No bajar de 2000.
  add column if not exists send_pause_min_ms int  not null default 2000,
  add column if not exists send_pause_max_ms int  not null default 6000,
  -- Ventana nocturna de los seguimientos, en hora local del negocio.
  add column if not exists quiet_hours_start int  not null default 23,
  add column if not exists quiet_hours_end   int  not null default 9;

create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- RLS prendida y SIN política: ningún usuario del panel puede leer esto.
-- La clave de servicio (el servidor) saltea RLS y es la única que entra.
-- Ver apps/bot/src/config/settings.ts.
alter table public.app_secrets enable row level security;

-- La tabla de migraciones tampoco tiene por qué ser pública.
alter table public._migrations enable row level security;
```

Claves que van en `app_secrets` (la lista cerrada vive en `settings.ts`):
`gemini_api_key`, `openai_api_key`, `whatsapp_api_key`,
`whatsapp_webhook_secret`.

### 1.4 `apps/bot/src/config/settings.ts` (archivo nuevo)

Reemplaza a la mitad de `env.ts`. Misma idea que `config/modules.ts`: caché
corta, se vacía a mano cuando el panel guarda algo.

```ts
import { randomBytes } from 'node:crypto'
import { db } from '../db/client.js'
import { getConfig, type AppConfig } from '../db/queries.js'

/**
 * La configuración del negocio, leída de la base.
 *
 * Antes esto era el .env: claves de IA, dirección del puente de WhatsApp,
 * tiempos del bot. Cada valor ahí era un lugar donde el alumno se podía
 * equivocar, y cambiarlo pedía reiniciar el servidor. Ahora vive en
 * `app_config` (lo que no es secreto) y `app_secrets` (las claves), y se
 * edita desde el panel.
 *
 * ¿Por qué una caché de veinte segundos? Un turno del bot consulta esto
 * tres o cuatro veces; leer dos tablas por cada consulta es plata tirada.
 * ¿Por qué no para siempre? Porque el dueño pega una clave nueva en el
 * panel y espera que el bot la use ya. Cuando el panel guarda a través
 * del servidor, además se vacía a mano (forgetSettings).
 */

export const SECRET_KEYS = [
  'gemini_api_key',
  'openai_api_key',
  'whatsapp_api_key',
  'whatsapp_webhook_secret',
] as const
export type SecretKey = (typeof SECRET_KEYS)[number]

/** Cada cuánto miran la cola, los turnos y los seguimientos. No es config del negocio. */
export const TICK_MS = { send: 8_000, turn: 10_000, followup: 60_000 }

export interface Settings {
  config: AppConfig
  llm: { provider: 'gemini' | 'openai'; model: string; geminiKey: string; openaiKey: string }
  whatsapp: { apiUrl: string; apiKey: string; session: string; webhookSecret: string }
  /** URL pública del deploy, para los links en los avisos al grupo. */
  publicUrl: string
  bot: {
    debounceSeconds: number
    sendPauseMinMs: number
    sendPauseMaxMs: number
    quietHoursStart: number
    quietHoursEnd: number
  }
}

const VIGENCIA_MS = 20_000
let cache: Settings | null = null
let leidoEn = 0

export function forgetSettings(): void {
  cache = null
}

async function readSecrets(): Promise<Record<string, string>> {
  const res = await db().from('app_secrets').select('key, value')
  if (res.error) throw res.error
  const out: Record<string, string> = {}
  for (const row of (res.data ?? []) as Array<{ key: string; value: string }>) out[row.key] = row.value
  return out
}

/**
 * La URL pública, sin que nadie la escriba: Railway la informa en
 * RAILWAY_PUBLIC_DOMAIN y Render en RENDER_EXTERNAL_URL. Si el hosting no
 * la da, el dueño la completa en el panel (app_config.public_url).
 */
function detectPublicUrl(config: AppConfig): string {
  if (config.public_url) return config.public_url.replace(/\/+$/, '')
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '')
  return ''
}

export async function getSettings(): Promise<Settings> {
  const ahora = Date.now()
  if (cache && ahora - leidoEn < VIGENCIA_MS) return cache

  const [config, secrets] = await Promise.all([getConfig(), readSecrets()])
  const provider = config.llm_provider === 'openai' ? 'openai' : 'gemini'

  cache = {
    config,
    llm: {
      provider,
      model: config.llm_model || (provider === 'openai' ? 'gpt-4.1-mini' : 'gemini-2.5-flash'),
      geminiKey: secrets.gemini_api_key ?? '',
      openaiKey: secrets.openai_api_key ?? '',
    },
    whatsapp: {
      apiUrl: (config.whatsapp_api_url ?? '').replace(/\/+$/, ''),
      apiKey: secrets.whatsapp_api_key ?? '',
      session: config.whatsapp_session || 'default',
      webhookSecret: secrets.whatsapp_webhook_secret ?? '',
    },
    publicUrl: detectPublicUrl(config),
    bot: {
      debounceSeconds: config.debounce_seconds ?? 90,
      sendPauseMinMs: config.send_pause_min_ms ?? 2000,
      sendPauseMaxMs: config.send_pause_max_ms ?? 6000,
      quietHoursStart: config.quiet_hours_start ?? 23,
      quietHoursEnd: config.quiet_hours_end ?? 9,
    },
  }
  leidoEn = ahora
  return cache
}

export function hasLlm(s: Settings): boolean {
  return Boolean(s.llm.provider === 'openai' ? s.llm.openaiKey : s.llm.geminiKey)
}

export function hasWhatsapp(s: Settings): boolean {
  return Boolean(s.whatsapp.apiUrl && s.whatsapp.apiKey)
}

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  const res = await db()
    .from('app_secrets')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (res.error) throw res.error
  forgetSettings()
}

/**
 * Lo que el panel puede saber de una clave: si está cargada y sus últimos
 * cuatro caracteres, para reconocerla. La clave entera no sale del
 * servidor jamás.
 */
export async function secretHints(): Promise<Record<SecretKey, { set: boolean; hint: string }>> {
  const secrets = await readSecrets()
  const out = {} as Record<SecretKey, { set: boolean; hint: string }>
  for (const key of SECRET_KEYS) {
    const v = secrets[key] ?? ''
    out[key] = { set: Boolean(v), hint: v ? `…${v.slice(-4)}` : '' }
  }
  return out
}

/**
 * El secreto del webhook lo inventa el servidor la primera vez que hace
 * falta. Nadie lo tipea, nadie lo ve: viaja en la URL del webhook que se
 * le da al puente, y el webhook lo compara. Ver routes/webhook.ts.
 */
export async function ensureWebhookSecret(): Promise<string> {
  const s = await getSettings()
  if (s.whatsapp.webhookSecret) return s.whatsapp.webhookSecret
  const nuevo = randomBytes(24).toString('hex')
  await setSecret('whatsapp_webhook_secret', nuevo)
  return nuevo
}
```

### 1.5 `apps/bot/src/config/env.ts` (queda así, entero)

```ts
/**
 * Variables de entorno. Son TRES y todas de Supabase: lo mínimo para que
 * el proceso arranque y pueda leer el resto de la configuración de la
 * base. Todo lo demás se carga desde el panel (ver config/settings.ts).
 *
 * Regla: si falta algo, el servidor NO arranca y dice exactamente qué.
 */

import { loadDotEnv } from './dotenv.js'

loadDotEnv()

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Falta la variable ${name}. Sale de Supabase → Settings → API. Local: copiá .env.example como .env y completala.`,
    )
  }
  return value
}

export interface Env {
  port: number
  supabase: { url: string; anonKey: string; serviceKey: string }
}

let cached: Env | null = null

export function loadEnv(): Env {
  if (cached) return cached
  const port = Number(process.env.PORT)
  cached = {
    port: Number.isFinite(port) && port > 0 ? port : 3000,
    supabase: {
      url: required('SUPABASE_URL').replace(/\/+$/, ''),
      anonKey: required('SUPABASE_ANON_KEY'),
      serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    },
  }
  return cached
}
```

### 1.6 Quién cambia

`AppConfig` en `db/queries.ts:223` suma los campos nuevos (con sus
defaults en el objeto vacío de `getConfig`). Después, archivo por archivo:

| Archivo | Hoy | Cambio |
|---|---|---|
| `agents/llm.ts:17,22,52` | `loadEnv().llm` | `const { llm } = await getSettings()`. El error dice *"Falta la clave de Gemini: cargala en el panel, pestaña Studio"* |
| `providers/waha.ts:32-38` | getter `cfg` sincrónico | `private async cfg() { return (await getSettings()).whatsapp }`; `isReady()` pasa a ser `async` |
| `workers/send-queue.ts:44-56` | pausas del env, `isReady()` | `const s = await getSettings(); if (!hasWhatsapp(s)) return`; pausas de `s.bot` |
| `workers/turns.ts:360-370` | `hasLlm(env)` al arrancar, tick del env | En cada `tick`: `if (!hasLlm(s)) return` — sin clave los turnos **esperan**, no fallan (ver 4.9). Intervalo `TICK_MS.turn` |
| `workers/followups.ts` | tick del env | `TICK_MS.followup`; `isNightAt(new Date(), tz, s.bot.quietHoursStart, s.bot.quietHoursEnd)` |
| `agents/followup.ts:35-61` | `NIGHT_START_HOUR` / `NIGHT_END_HOUR` fijos | Las dos funciones reciben `start` y `end` como parámetros |
| `routes/webhook.ts:30-38,117` | secreto y espera del env | de `getSettings()`; el secreto se exige **siempre** (ver 4.3) |
| `routes/panel.ts:131,168-196` | `loadEnv()` | `getSettings()`; `startSession` usa `await ensureWebhookSecret()` |
| `routes/health.ts` | `loadEnv()` | `getSettings()` (la ruta pasa a `async`) |
| `notifications/notify.ts:59-63` | `loadEnv().publicUrl` | `conversationLink` pasa a `async` y lee `(await getSettings()).publicUrl` |
| `index.ts:66-68` | `hasWhatsapp(env)` | se borra; el aviso de "sin configurar" sale en el tick de la cola |

### 1.7 El panel deja de necesitar variables en el build

Hoy `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se hornean en el build de
Vite. Si faltan al compilar, el login dice *"Faltan VITE_…"*, y no hay forma
de arreglarlo sin recompilar. El servidor ya sabe la URL y la clave pública:
que las sirva.

`apps/bot/src/index.ts`, **antes** de `app.use('/*', serveStatic(...))`:

```ts
// ── Config pública del panel ──────────────────────────────────
// La URL y la clave pública de Supabase las sirve el servidor en tiempo
// de ejecución, no se hornean en el build. Así un mismo build anda en
// cualquier instalación, y el alumno no tiene que recompilar nada. La
// clave anon es pública por diseño: la protección son las policies.
app.get('/config.js', (c) => {
  const cfg = JSON.stringify({
    supabaseUrl: env.supabase.url,
    supabaseAnonKey: env.supabase.anonKey,
  })
  return c.body(`window.__FW__ = ${cfg};`, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store',
  })
})
```

`apps/panel/index.html` — una línea antes del `<script type="module">`
(los scripts clásicos corren antes que los módulos, así `window.__FW__`
existe cuando arranca React):

```html
<script src="/config.js"></script>
```

`apps/panel/vite.config.js` — una línea más en el proxy:

```js
'/config.js': 'http://localhost:3000',
```

`apps/panel/src/lib/supabase.js` — las dos líneas de `import.meta.env`
pasan a:

```js
const cfg = (typeof window !== 'undefined' && window.__FW__) || {}
const url = cfg.supabaseUrl
const anonKey = cfg.supabaseAnonKey
```

Y el mensaje de `Login.jsx:20-22` pasa a: *"El servidor no informó la
conexión a Supabase. Revisá SUPABASE_URL y SUPABASE_ANON_KEY en el hosting."*

### 1.8 Dónde se cargan las claves en el panel

Cada clave vive en la pantalla donde se usa, no en una pantalla "Claves"
aparte: para conectar WhatsApp el alumno va a **Conexión**; para la IA va a
**Studio**. Los tiempos van a **Ajustes**, en una tarjeta "Avanzado".

| Pantalla | Tarjeta nueva | Campos |
|---|---|---|
| Conexión (`pages/Conexion.jsx`) | "Puente de WhatsApp", arriba del QR | URL del puente (`app_config.whatsapp_api_url`), clave (`app_secrets.whatsapp_api_key`), botón **Probar conexión**, nombre de sesión (plegado, "avanzado") |
| Studio (`pages/Studio.jsx`) | "Modelo de IA", arriba de los prompts | proveedor (select gemini/openai), modelo (texto con ayuda), clave del proveedor elegido, botón **Probar clave** |
| Ajustes (`pages/Ajustes.jsx`) | "Avanzado", al final | espera antes de contestar (segundos), pausa mínima y máxima entre envíos, ventana nocturna (desde / hasta), URL pública (solo si no se detectó), moneda |

Rutas nuevas en `routes/panel.ts` (todas detrás de `requirePanelUser`):

```ts
import { SECRET_KEYS, secretHints, setSecret, forgetSettings } from '../config/settings.js'

// ── Claves ───────────────────────────────────────────────────
// El navegador nunca recibe una clave entera: solo si está cargada y sus
// últimos caracteres. Pegar una nueva la pisa; guardar vacío la borra.
panelRoute.get('/secrets', async (c) => c.json(await secretHints()))

panelRoute.post('/secrets', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }
  for (const key of SECRET_KEYS) {
    if (typeof body[key] === 'string') await setSecret(key, (body[key] as string).trim())
  }
  return c.json({ ok: true, claves: await secretHints() })
})

// El panel escribió app_config directo (Studio, Ajustes): que el servidor
// se entere ya, sin esperar los veinte segundos de la caché.
panelRoute.post('/settings/reload', (c) => {
  forgetSettings()
  return c.json({ ok: true })
})

// Probar una clave sin adivinar: una llamada mínima al proveedor. Devuelve
// 200 con ok:false si falla, porque "falló la prueba" no es un error del
// servidor: es la respuesta.
panelRoute.post('/secrets/test', async (c) => {
  const { que } = (await c.req.json().catch(() => ({}))) as { que?: string }
  try {
    if (que === 'llm') {
      const r = await chat('Respondé solo con la palabra OK.', [{ role: 'user', content: 'ping' }])
      return c.json({ ok: true, respuesta: r.slice(0, 40) })
    }
    if (que === 'whatsapp') {
      await whatsapp().ping() // GET /api/sessions: 200 = URL y clave correctas
      return c.json({ ok: true })
    }
    return c.json({ error: 'que debe ser llm o whatsapp' }, 400)
  } catch (err) {
    return c.json({ ok: false, error: describe(err) })
  }
})
```

`ping()` en `providers/waha.ts`:

```ts
/** ¿La URL y la clave son correctas? Lista las sesiones: 401 si la clave está mal. */
async ping(): Promise<void> {
  await this.call('/api/sessions', undefined, 'GET')
}
```

Componente reutilizable `apps/panel/src/ui/CampoClave.jsx` (lo usan
Conexión y Studio):

```jsx
import { useState } from 'react'
import { Save } from 'lucide-react'

/**
 * Un campo para una clave secreta. Nunca muestra la guardada: solo que
 * está cargada y sus últimos caracteres, para reconocerla. Pegar una
 * nueva la reemplaza. `estado` viene de GET /api/panel/secrets.
 */
export default function CampoClave({ etiqueta, estado, onGuardar }) {
  const [valor, setValor] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await onGuardar(valor.trim())
      setValor('')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <label className="field">
      <span>
        {etiqueta}{' '}
        {estado?.set ? (
          <span className="chip ok">cargada {estado.hint}</span>
        ) : (
          <span className="chip">sin cargar</span>
        )}
      </span>
      <div className="clave-row">
        <input
          type="password"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={estado?.set ? 'Pegá una nueva para reemplazarla' : 'Pegá la clave'}
          autoComplete="off"
        />
        <button className="btn primary" onClick={guardar} disabled={guardando || !valor.trim()}>
          <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </label>
  )
}
```

Uso en Studio: `<CampoClave etiqueta="Clave de Gemini" estado={claves.gemini_api_key} onGuardar={(v) => api('/secrets', { gemini_api_key: v }).then(r => setClaves(r.claves))} />`.

CSS (`styles.css`): `.clave-row { display: flex; gap: 8px }`,
`.clave-row input { flex: 1 }`, y en mobile `.clave-row { flex-wrap: wrap }`.

### 1.9 Dos cosas que dejan de existir como configuración

- **`PUBLIC_URL`**: Railway informa `RAILWAY_PUBLIC_DOMAIN` y Render
  `RENDER_EXTERNAL_URL`. `settings.ts` las lee. La pantalla Conexión muestra
  *"URL pública detectada: https://…"* y solo ofrece el campo si quedó vacía.
- **`WHATSAPP_WEBHOOK_SECRET`**: lo genera el servidor (`ensureWebhookSecret`)
  la primera vez que se arranca una sesión. Nadie lo tipea.

---

## 2. Instalación: de clonar a bot andando, sin terminal

### 2.1 Qué hay hoy

`scripts/setup.mjs` es correcto pero pide lo más difícil de conseguir de todo
el proceso: la **URI de Postgres con la contraseña de la base**
(`setup.mjs:124-136`). Para tenerla, el alumno tiene que ir a Connect →
Session pooler, y si no anotó la contraseña al crear el proyecto (nadie la
anota), resetearla. Es el paso en el que más gente se va a trabar, y ni
siquiera es necesario: el servidor con la clave de servicio ya puede hacer
todo lo demás (escribir config, sembrar, crear el usuario). Lo único que no
puede hacer por PostgREST es DDL: crear tablas.

Y la migración `0001_core.sql` tenía un error de sintaxis que la hacía fallar
siempre (ya arreglado en el working tree): el instalador nunca había corrido
de punta a punta contra una base vacía.

### 2.2 Cómo queda: el instalador es una pantalla del panel

El alumno despliega en Railway con las tres variables, abre la URL, y el
panel lo lleva:

1. **"Preparar la base"**: el panel muestra el SQL pendiente y un botón
   *Copiar*. El alumno lo pega en Supabase → SQL Editor → Run. Vuelve y toca
   *Verificar*. (Un solo paste; el servidor sabe qué falta leyendo
   `_migrations`.)
2. **"El negocio"**: pack (Ecommerce / Servicios), nombre, zona horaria
   (lista desplegable), moneda, ¿sembrar catálogo de ejemplo?
3. **"Tu usuario"**: email y contraseña del dueño.
4. **Listo** → pantalla de login.

Después, la misma pantalla sirve para las actualizaciones: cuando un push
trae una migración nueva, el panel avisa *"Hay cambios pendientes en la
base"* con el mismo botón Copiar.

**Seguridad del asistente.** Las rutas son públicas (no hay usuario todavía),
así que hay que probar que quien completa el paso 3 es quien tiene acceso a
la base. El truco: el SQL que se le da para pegar incluye un **token de
instalación** al azar; el paso 3 lo manda de vuelta y el servidor lo compara
con lo que quedó en la base. Quien no pegó ese SQL en ese Supabase no lo
tiene. Y el paso 3 se niega si ya existe algún usuario.

Migración `0010_instalador.sql`:

```sql
-- ============================================================
-- 0010 — El asistente de instalación del panel
--
-- install_token: lo trae el SQL que el alumno pega en Supabase. Es la
-- prueba de que quien termina la instalación desde el navegador es
-- quien tiene acceso a esa base — sin esto, cualquiera que encontrara la
-- URL antes que el dueño podría crearse el usuario.
-- ============================================================
alter table public.app_config
  add column if not exists install_token text,
  add column if not exists installed_at  timestamptz;
```

Rutas nuevas, `apps/bot/src/routes/install.ts` (públicas, montadas en
`/api/install`):

| Ruta | Qué hace |
|---|---|
| `GET /status` | `{ dbReady, pending: ['0007_settings.sql', …], installed, pack, businessName }`. `dbReady` = pudo leer `app_config`. `installed` = hay usuarios en Auth. |
| `GET /sql` | Texto: `create table if not exists _migrations …` + cada migración pendiente + su `insert into _migrations` + `update app_config set install_token = '<random>'` (solo si no está instalado). Guarda el token que generó en memoria para compararlo. |
| `POST /finish` | Cuerpo: `{ token, pack, businessName, timezone, currency, seedDemo, ownerEmail, ownerPassword }`. Rechaza con 409 si `installed`; con 403 si el token no coincide con `app_config.install_token`. Hace lo que hoy hacen los pasos 5-7 de `setup.mjs` (config del pack desde `packages/core`, módulos, siembra por PostgREST, `auth.admin.createUser`, fila en `team_members`) y marca `installed_at`. |

La siembra del catálogo pasa de SQL a filas por PostgREST (el servidor no
tiene conexión directa). `packages/db/seeds/demo-*.sql` se reescriben como
`packages/core/src/seeds.js` exportando arrays — una sola fuente, sin `pg`.

Panel: `pages/Instalar.jsx`, y `RequireAuth.jsx` consulta `/api/install/status`
antes de mostrar Login: si `!installed`, muestra Instalar.

### 2.3 `scripts/setup.mjs` y `pg`

Con el asistente, el instalador de terminal queda solo para desarrollo
local, y se simplifica: crea el `.env` desde `.env.example` y te dice que
abras el panel. La dependencia `pg` se va del `package.json` raíz (y la
advertencia del certificado en `setup.mjs:55-58`, con ella).

Para quien prefiera terminal, `npm run db:sql` imprime el mismo SQL que el
asistente, para pegar:

```js
// scripts/db-sql.mjs — imprime las migraciones para pegar en el SQL Editor
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'db', 'migrations')
const partes = [
  'create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now());',
]
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  partes.push(`-- >>> ${file}`)
  partes.push(readFileSync(join(dir, file), 'utf8'))
  partes.push(`insert into public._migrations (name) values ('${file}') on conflict do nothing;`)
}
process.stdout.write(partes.join('\n\n') + '\n')
```

Una migración ya aplicada re-pegada no rompe nada: todas usan
`if not exists` / `or replace` y los bloques `do` atrapan `duplicate_object`.

### 2.4 `docs/DEPLOY.md` nuevo (los pasos, para pegar)

```markdown
# Poner el sistema en línea

Tres servicios, un solo lugar donde mirar: Supabase (la base), Railway (el
servidor y el puente de WhatsApp). Veinte minutos.

## 1. Supabase — la base

1. https://supabase.com → New project. Anotá la contraseña, aunque no la vas a necesitar.
2. Settings → API. Copiá tres cosas: **Project URL**, **anon public**, **service_role**.
3. Authentication → Sign In / Providers → **desactivá "Allow new users to sign up"**.
   (Los usuarios los crea el panel. Con esto prendido, cualquiera podría registrarse.)

## 2. Railway — el servidor

1. https://railway.app → New Project → Deploy from GitHub repo → este repo.
2. Pestaña Variables → **Raw Editor** → pegá y reemplazá los tres valores:

   SUPABASE_URL=https://TU_PROYECTO.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...

3. Settings → Networking → **Generate Domain**. Esa es tu URL.
4. Abrí la URL. El asistente te pide pegar un SQL en Supabase → SQL Editor → Run,
   después el nombre del negocio, el pack y tu usuario. Listo.

## 3. Railway — el puente de WhatsApp (WAHA)

En el mismo proyecto: **+ New → Docker Image** → `devlikeapro/waha`.

1. Variables → Raw Editor:

   WHATSAPP_API_KEY=inventá-una-clave-larga
   WAHA_DASHBOARD_USERNAME=admin
   WAHA_DASHBOARD_PASSWORD=inventá-otra
   WHATSAPP_DEFAULT_ENGINE=WEBJS

2. Settings → Volumes → **Add Volume** → mount path `/app/.sessions`.
   Sin esto, cada redeploy pide escanear el QR de nuevo.
3. Settings → Networking → Generate Domain (puerto 3000).

## 4. Conectar

1. Panel → **Conexión**: pegá la URL del puente y la clave (WHATSAPP_API_KEY). Probar conexión.
2. Arrancar la sesión → escaneá el QR con el número DEDICADO del negocio.
3. Panel → **Studio**: pegá la clave de Gemini (https://aistudio.google.com/apikey). Probar clave.
4. Panel → **Probar el bot**: charlá. Después mandate un WhatsApp desde otro teléfono.
```

---

## 3. WAHA: una instancia por alumno, o un servidor compartido

### 3.1 Lo que cambió

Desde la versión **2026.6.1** de WAHA, todo lo que antes era de pago (WAHA
Plus) está en la versión gratis: sesiones ilimitadas por instancia,
multimedia (recibir y mandar imágenes y audios), todos los almacenamientos
de sesión, seguridad. La imagen es una sola, pública: `devlikeapro/waha`. El
único "plan" que queda es un aporte voluntario en Patreon (5 dólares por
mes, sin ventajas). La decisión abierta de `PLAN.md` ("confirmar si la
versión libre maneja imágenes y audios") **queda cerrada: sí.**

Lo que NO cambió: la clave de API es **una por instancia**, no por sesión.
Quien tiene la clave puede mandar mensajes desde cualquier sesión de esa
instancia.

### 3.2 Las dos formas de armarlo

| | A. Una instancia por alumno | B. Un servidor compartido con muchas sesiones |
|---|---|---|
| Dónde | Railway, mismo proyecto que el bot, imagen Docker | Un VPS (Hetzner, DigitalOcean) con Docker |
| Aislamiento | Total: su clave, su sesión, su volumen | Ninguno: una clave para todos; un alumno podría mandar por el número de otro |
| Costo por instalación | El servicio de WAHA, según uso | Prorrateado; con GOWS/NOWEB entran decenas por servidor |
| Quién lo mantiene | El alumno | Vos (actualizaciones, reinicios, disco) |
| Encaja con "una instalación es un negocio" | Sí | No: el puente vuelve a ser un servicio central |

**Recomendación: A para el curso.** Es la única que respeta la decisión 3 de
`DECISIONES.md` (el alumno es dueño de su instalación y se la vende a un
cliente) y no te convierte en el soporte de todos los números. B sirve para
**una agencia que administra sus propios clientes**: un servidor, una
sesión por cliente, cada sesión con su webhook apuntando al bot de ese
cliente. El sistema ya lo soporta sin tocar código (`app_config.whatsapp_session`
es el nombre de la sesión). Se enseña como la clase de "cuando tenés diez
clientes", no como el camino por defecto.

### 3.3 Lo que hay que saber de la instancia en Railway

- **Volumen obligatorio** en `/app/.sessions`. La sesión de WhatsApp vive en
  archivos; sin volumen, cada redeploy de WAHA pide QR de nuevo.
- **Motor**: `WEBJS` es el más probado y el que usa `parseWebhook`
  (`_data.notifyName` es de WEBJS). Corre un Chromium: pedí memoria (medio
  giga por sesión). Para B, `GOWS` o `NOWEB` no corren navegador y entran
  muchas más sesiones por servidor — pero el nombre del contacto viene en
  otro campo (`pushName`), y hay que agregarlo a `parseWebhook`.
- **Puerto**: WAHA escucha en 3000. Al generar el dominio, Railway pregunta el puerto.
- **Dashboard**: `https://tu-waha/dashboard` con el usuario y contraseña de
  las variables. Sirve para ver la sesión sin el panel — útil para soporte.
- **Chats con `@lid`**: WhatsApp empezó a identificar algunos contactos con
  un id que no es el teléfono (`123456@lid`). `findOrCreateConversation`
  guarda `phone = chatId.split('@')[0]` (`queries.ts:53`): para esos
  contactos la "ficha" muestra un número que no es un teléfono. Guardar
  `chat_id` entero en el contacto y mostrar el teléfono solo cuando termina
  en `@c.us`. **[BAJA]**, pero va a pasar.

### 3.4 Costos reales por instalación (para la página de venta)

Railway cobra por uso; el plan Hobby incluye 5 dólares de uso por mes.

| Servicio | Por mes, aproximado |
|---|---|
| Servidor del bot | 3 a 5 dólares |
| WAHA con WEBJS (Chromium) | 5 a 8 dólares |
| Volumen de WAHA | menos de 1 dólar |
| Supabase | gratis para empezar |
| Gemini | centavos por conversación |

El "5 a 7 dólares" que hoy dice `README.md`, `PLAN.md`, `DECISIONES.md` y
`DEPLOY.md` es solo el bot. Con WAHA adentro es **10 a 15**. Corregirlo en
los cuatro lugares antes de que alguien lo cite en una venta.

Dos avisos que van en la clase de costos: el plan gratis de Supabase
**pausa el proyecto después de una semana sin actividad** (un bot sin
tráfico deja de responder hasta que alguien lo despierta desde el panel de
Supabase), y no tiene respaldos automáticos (eso es del plan Pro).

---

## 4. Fallas encontradas en el código

Nada de esto se probó contra un WAHA real (no hay número conectado todavía).
Las cuatro [ALTA] salen de leer el código contra cómo se comporta WhatsApp y
el puente; la 4.2 es la única que es *probable* y no *segura*: hay que
verla pasar con el número conectado antes de darla por cerrada.

### 4.1 [ALTA] Los mensajes de grupos entran como conversaciones

`providers/waha.ts:136-165`. `parseWebhook` acepta cualquier `chatId`. WAHA
manda por el webhook los mensajes de **grupos** (`…@g.us`), los estados
(`status@broadcast`) y los canales (`…@newsletter`). Incluido el grupo de
avisos del negocio: cuando el bot manda *"Necesita una persona"* al grupo,
vuelve el eco con `fromMe`, se crea una conversación con el grupo como
"contacto" (con el id del grupo como teléfono), y se pausa. Después,
cualquier persona que escriba en el grupo dispara un turno y **el bot le
contesta al equipo dentro del grupo**.

Arreglo, en `parseWebhook` después de calcular `chatId`:

```ts
// Grupos, estados y canales no son conversaciones de clientes. El grupo
// de avisos del negocio entra por acá: sin este corte, el bot le
// contesta al equipo adentro del grupo.
if (chatId.endsWith('@g.us') || chatId.endsWith('@broadcast') || chatId.endsWith('@newsletter')) {
  return null
}
```

### 4.2 [ALTA, probable] El bot toma su propio mensaje como una persona y se calla

`routes/webhook.ts:57-81` y `workers/send-queue.ts:59-74`. Un eco (`fromMe`)
que no está guardado en `messages` se toma como "alguien contestó desde el
celular" y pausa la conversación. La cola guarda el mensaje **después** de
que `sendText` responde, en dos viajes más a la base. El puente dispara el
webhook del eco en cuanto el mensaje sale por WhatsApp Web, que es antes de
contestar el HTTP. Es una carrera, y cuando la gana el webhook el bot se
pausa a sí mismo en la primera respuesta y no vuelve a hablar en ese chat.

Arreglo: preguntarle a la cola. Nueva consulta en `db/queries.ts`:

```ts
/**
 * ¿Este texto lo mandamos nosotros a este chat hace un rato? Cubre la
 * carrera del eco: el puente avisa "salió un mensaje tuyo" a veces ANTES
 * de que la cola termine de guardarlo con su id. Sin esto, el bot toma su
 * propio mensaje como una persona escribiendo desde el celular y se calla.
 */
export async function recentlySentByUs(chatId: string, body: string): Promise<boolean> {
  const desde = new Date(Date.now() - 5 * 60_000).toISOString()
  const res = await db()
    .from('send_queue')
    .select('id', { count: 'exact', head: true })
    .eq('chat_id', chatId)
    .eq('body', body)
    .in('status', ['sending', 'sent'])
    .gte('created_at', desde)
  if (res.error) throw res.error
  return (res.count ?? 0) > 0
}
```

Y en `webhook.ts:62`:

```ts
if (yaGuardado || (await recentlySentByUs(mensaje.chatId, mensaje.text))) {
  return c.json({ ok: true, eco: 'propio' })
}
```

### 4.3 [ALTA] Sin secreto, cualquiera manda mensajes desde el número del negocio

`routes/webhook.ts:32-38`. El secreto es opcional. Una instalación sin
`WHATSAPP_WEBHOOK_SECRET` (hoy, todas las que sigan el camino corto) acepta
cualquier POST: alguien que conozca la URL manda
`{"event":"message","payload":{"id":"x","from":"5989…@c.us","body":"hola"}}`
y el bot le escribe a ese número **desde el WhatsApp del negocio**, con la
clave de IA del negocio. Es spam gratis con el número de otro.

Arreglo: el secreto lo genera el servidor (`ensureWebhookSecret`, punto 1.4)
y se exige siempre:

```ts
const s = await getSettings()
const recibido = c.req.header('x-webhook-secret') ?? c.req.query('secret')
// Sin secreto configurado todavía (la sesión nunca se arrancó desde el
// panel) no hay webhook válido posible: se rechaza todo.
if (!s.whatsapp.webhookSecret || recibido !== s.whatsapp.webhookSecret) {
  return c.json({ error: 'secreto inválido' }, 401)
}
```

### 4.4 [ALTA] Cualquiera que se registre en Supabase ve toda la base

Las políticas `equipo` (`0001_core.sql:133-146` y siguientes) le dan todo a
cualquier usuario `authenticated`. La clave anon está en el navegador
(pública por diseño) y un proyecto de Supabase **permite registrarse por
defecto**. Alguien con la URL del panel: `signUp` con su propio email,
confirma, entra, y lee conversaciones, contactos y pedidos de un negocio
ajeno.

Arreglo en dos capas. Primera, la base decide quién es del equipo —
migración `0008_equipo.sql`:

```sql
-- ============================================================
-- 0008 — Quién es del equipo
--
-- Hasta acá, "estar logueado" alcanzaba para ver todo. Pero registrarse
-- en Supabase está abierto por defecto, y la clave pública viaja al
-- navegador: cualquiera podía crearse un usuario y entrar. Ahora un
-- usuario ve la base solo si su email está en team_members, que se
-- administra desde el panel (Ajustes → Usuarios).
-- ============================================================

create table if not exists public.team_members (
  email      text primary key,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;

-- Quien ya tenía usuario sigue entrando: se importa desde Auth.
insert into public.team_members (email, role)
select lower(email), 'owner' from auth.users where email is not null
on conflict (email) do nothing;

-- security definer: corre como el dueño de la tabla y saltea RLS. Sin
-- eso, la policy de team_members llamaría a esta función, que leería
-- team_members, que aplicaría la policy… recursión infinita.
create or replace function public.is_team()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
     where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'app_config', 'modules', 'contacts', 'catalog_items', 'orders',
    'conversations', 'messages', 'send_queue', 'prompts', 'notification_episodes',
    'event_log', 'review_queue', 'followups'
  ]
  loop
    execute format('drop policy if exists equipo on public.%I', t);
    execute format(
      'create policy equipo on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())',
      t
    );
  end loop;
end $$;

-- El equipo se ve a sí mismo. Altas y bajas van por el servidor.
drop policy if exists equipo on public.team_members;
create policy equipo on public.team_members
  for select to authenticated using (public.is_team());
```

Segunda, el servidor también lo chequea — `middleware/auth.ts:42-43`:

```ts
const { data, error } = await db().auth.getUser(token)
const email = data?.user?.email?.toLowerCase()
if (error || !email) return c.json({ error: 'Credenciales inválidas' }, 401)

const miembro = await db().from('team_members').select('email').eq('email', email).maybeSingle()
if (!miembro.data) return c.json({ error: 'Tu usuario no es del equipo de este negocio' }, 403)
```

Y de yapa, en `DEPLOY.md`: desactivar "Allow new users to sign up" en
Supabase (ya está en el paso 1 del punto 2.4). Con las dos capas, un
registro suelto no ve nada aunque el alumno se olvide del toggle.

### 4.5 [MEDIA] Una foto o un audio sin texto tira el turno

`routes/webhook.ts:84-93` guarda `body: ''`; `workers/turns.ts:135-138` lo
manda al modelo tal cual. Gemini rechaza un `text` vacío con 400. Resultado:
`turn.failed`, aviso de *"EL BOT NO PUDO CONTESTAR"* al grupo, cliente mudo
— por mandar una foto. Con los módulos `vision`/`audio` apagados, lo mínimo
es que el modelo sepa que llegó un archivo.

`db/queries.ts:178-187`: `history` selecciona también `media_kind`.
`workers/turns.ts:136`:

```ts
content:
  m.body ||
  (m.media_kind ? `(el cliente mandó un archivo: ${m.media_kind})` : '(mensaje sin texto)'),
```

Y en `providers/waha.ts:150-153`, si `p.hasMedia` es true pero el puente no
dio URL, igual se registra el tipo:

```ts
const media = p.hasMedia
  ? { url: p.media?.url ?? '', kind: mimetype.split('/')[0] || 'file' }
  : null
```

### 4.6 [MEDIA] Un error de tipeo en la zona horaria deja mudo al bot

`pages/Studio.jsx:85-92` acepta cualquier texto. `utils/datetime.ts:13` y
`agents/followup.ts:39-41` llaman a `toLocaleString` con esa zona: con
`America/Montevideoo` tira `RangeError` **en cada turno**. Un dueño que
"corrige" la zona apaga el bot sin saberlo.

`utils/datetime.ts`:

```ts
/**
 * Una zona horaria mal escrita hace explotar toLocaleString en cada
 * turno. UTC con un aviso en consola es mejor que un bot mudo.
 */
export function safeTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    console.warn(`[fecha] zona horaria inválida "${tz}", se usa UTC`)
    return 'UTC'
  }
}
```

Se usa en `formatNowForPrompt` y en `localHour`. Y en Studio el campo pasa
a ser un `<select>` armado con `Intl.supportedValuesOf('timeZone')` — la
lista completa, con las de `America/` primero.

### 4.7 [MEDIA] Un envío interrumpido por un reinicio queda atascado para siempre

`0002_bot.sql:146-163`. `claim_next_send` marca `sending` y solo vuelve a
reclamar `pending`. Si el proceso muere entre reclamar y marcar (un redeploy
de Railway justo ahí), esa fila queda en `sending` para siempre y ese
mensaje nunca sale. Nadie se entera.

Migración `0009_robustez.sql`, parte 1:

```sql
-- Reclama también lo que quedó en 'sending' hace más de tres minutos: el
-- proceso murió en el medio (un redeploy). Cuenta como un intento más,
-- así después de tres muertes seguidas se rinde igual que una falla.
create or replace function public.claim_next_send()
returns setof public.send_queue
language sql
as $$
  update public.send_queue q
     set status = 'sending',
         claimed_at = now(),
         attempts = q.attempts + 1
   where q.id = (
     select id
       from public.send_queue
      where status = 'pending'
         or (status = 'sending' and claimed_at < now() - interval '3 minutes')
      order by created_at
        for update skip locked
      limit 1
   )
  returning q.*;
$$;
```

### 4.8 [MEDIA] Un turno reclamado y un proceso muerto es un cliente sin respuesta

`0002_bot.sql:170-187`. Reclamar el turno es poner `respond_after` en null.
Si el proceso muere después de reclamar y antes de encolar la respuesta,
la conversación queda en `bot`, sin turno, con el último mensaje del
cliente sin contestar. El comentario de `workers/turns.ts:27-37` promete
que un reinicio no pierde turnos; es cierto para los no reclamados, no para
el que estaba corriendo.

`0009_robustez.sql`, parte 2 — se llama al arrancar el servidor:

```sql
-- Al arrancar: las conversaciones en manos del bot, sin turno agendado,
-- cuyo último mensaje es del cliente y tiene más de dos minutos (menos es
-- una respuesta que todavía está en la cola de envío), vuelven a tener
-- turno. Es el turno que se perdió con el proceso anterior.
create or replace function public.recover_unanswered_turns(delay_seconds int default 30)
returns int
language plpgsql
as $$
declare n int;
begin
  update public.conversations c
     set respond_after = now() + make_interval(secs => delay_seconds)
   where c.state = 'bot'
     and c.respond_after is null
     and (
       select m.author from public.messages m
        where m.conversation_id = c.id
        order by m.created_at desc limit 1
     ) = 'customer'
     and (
       select max(m.created_at) from public.messages m where m.conversation_id = c.id
     ) between now() - interval '24 hours' and now() - interval '2 minutes'
     and not exists (
       select 1 from public.send_queue s
        where s.conversation_id = c.id and s.status in ('pending', 'sending')
     );
  get diagnostics n = row_count;
  return n;
end $$;
```

En `index.ts`, antes de `startTurns()`:

```ts
const recuperados = await recoverUnansweredTurns()
if (recuperados) console.log(`[turno] ${recuperados} conversación(es) sin responder recuperadas del arranque anterior`)
```

### 4.9 [MEDIA] Sin clave de IA, cada mensaje es un aviso de "turno caído"

`workers/turns.ts:140` con `hasLlm` en false: `chat()` tira *"Falta
GEMINI_API_KEY"*, el turno cae, y el grupo recibe *"EL BOT NO PUDO
CONTESTAR"* por cada mensaje. Antes de cargar la clave, una instalación
nueva se llena de alarmas. Ya está resuelto por la tabla del punto 1.6: sin
clave, el tick no reclama turnos y los deja esperando; el panel muestra el
aviso (4.10).

### 4.10 [BAJA] Sin WhatsApp conectado, lo que se escribe desde el panel queda "en cola" sin explicación

`workers/send-queue.ts:48` sale sin decir nada. `Conversaciones.jsx:271-276`
muestra la burbuja *"en cola de envío…"* para siempre. Dos cambios: `/health`
devuelve `llm: 'configurado' | 'sin clave'` y `whatsapp: …`, y `Layout.jsx`
lo consulta al cargar y muestra una franja arriba: *"WhatsApp sin conectar
— los mensajes esperan"* / *"Falta la clave de IA — el bot no contesta"*,
con link a la pestaña que corresponde. Y `/api/panel/reply` devuelve 409
*"Conectá WhatsApp primero"* si no hay puente.

### 4.11 [BAJA] Módulos sin código que se pueden prender

`packages/core/src/index.js:11-20` lista `shipping` y `ads`, que no tienen
una línea de código. En Ajustes aparecen como interruptores que no hacen
nada. Agregar `available: false` a esos dos y que Ajustes los muestre
deshabilitados con *"próximamente"*.

### 4.12 [BAJA] `event_log` crece sin límite

Cada turno graba varias filas. En un año son cientos de miles. Un borrado
de lo que tenga más de noventa días, una vez por día, en el tick de
seguimientos (`workers/followups.ts`): `delete from event_log where
created_at < now() - interval '90 days'` — como función SQL en 0009 y una
llamada con `Date.now()` recordando la última corrida.

### 4.13 [BAJA] Moneda y ciudad fijas

`0001_core.sql:76` pone `currency 'UYU'`; `Pedidos.jsx:96`,
`Catalogo.jsx:111`, `Conversaciones.jsx:241`, `Metricas.jsx:52` y
`orders/from-chat.ts:96-97` escriben `$` fijo. La zona por defecto es
`America/Montevideo` en cuatro lugares. Con `app_config.currency` (0007) el
panel muestra ese símbolo, y el asistente de instalación pregunta zona y
moneda. La regla 1 de `CLAUDE.md` pide sacar Montevideo: el default puede
ser `UTC` y que la instalación lo elija.

### 4.14 [BAJA] Prolijidad

- `pages/Ajustes.jsx:42`: la clase de caracteres está escrita con los
  caracteres combinantes literales (invisibles en el editor); se lee mejor
  con los escapes `\u0300-\u036f` adentro de los corchetes.
- `pages/Ajustes.jsx:92`: "recargá la página" después de prender un módulo.
  Con un `window.dispatchEvent(new Event('fw:modules'))` al guardar y un
  listener en `Layout.jsx` que vuelva a leer `modules`, la pestaña aparece
  sola.
- `config/env.ts:75`: `LOG_LEVEL` se lee y no se usa. Se va con el punto 1.
- `package.json` raíz y `apps/bot/package.json` piden versiones distintas de
  `@supabase/supabase-js` (`^2.112` y `^2.47`). Dejar una.

---

## 5. Prompts, prueba y lo que falta en el panel

### 5.1 [MEDIA] Dos frases con voz del negocio están escritas en el código

- `workers/turns.ts:48`: `LINEA_PUENTE = 'Dame un momentito que lo reviso y te escribo 🙌'`
- `workers/turns.ts:221`: `'Dale! Ya quedó anotado, apenas el equipo lo confirme te aviso por acá 🙌'`

Las dos le llegan al cliente. Una clínica no dice "Dale!". Van a la tabla
`prompts` como secciones `mensaje_puente` y `mensaje_pedido_anotado`,
sembradas en `0007_settings.sql` con el mismo patrón que las demás
(`insert … where not exists`), y `turns.ts` las lee de `getPrompts()`. En
Studio aparecen en una tarjeta "Mensajes fijos" con una línea de ayuda
que diga cuándo se manda cada uno.

Los avisos al grupo (`notifications/notify.ts:137,164,196`) son internos
del equipo y pueden quedar en código.

### 5.2 [MEDIA] Probar el bot: ver lo que lee la IA y probar sin conectar nada

`pages/TestChat.jsx` ya muestra la decisión completa. Le faltan tres cosas
para que sea la herramienta de "confirmar el prompt":

1. **Ver lo que lee la IA.** Ruta `GET /api/panel/test-context` que devuelve
   `{ system }` de `buildTurnContext('whatsapp')`. Un botón en la cabecera
   del simulador abre un panel plegable con ese texto. Es la forma de
   entender por qué contestó lo que contestó: nombre, prompts, fecha,
   catálogo con ids, motivos.
2. **Probar la clave y el modelo** desde Studio (punto 1.8), con el nombre
   del modelo a la vista: el 404 más común es un modelo que ya no existe.
3. **Probar seguimientos.** Hoy no hay forma de ver qué recordatorio
   escribiría el bot sin esperar horas. Separar en `agents/followup.ts` la
   decisión (`decideFollowups(...)` devuelve la lista) de la programación
   (`scheduleFollowup`), y una ruta `POST /api/panel/test-followups` que
   recibe el historial del simulador y devuelve la lista sin agendar nada.
   Botón *"¿Qué recordatorio mandaría?"* en el simulador.

### 5.3 [MEDIA] No hay pantalla de usuarios

El único usuario lo crea el instalador. Un negocio con dos personas
atendiendo no tiene forma de sumar a la segunda, ni de cambiar una
contraseña olvidada. Con `team_members` (4.4) es obligatorio tenerla.

Rutas en `routes/panel.ts`:

| Ruta | Qué hace |
|---|---|
| `GET /users` | `auth.admin.listUsers()` + `team_members`: email, rol, último ingreso |
| `POST /users` | `{ email, password }` → `auth.admin.createUser({ email_confirm: true })` + fila en `team_members` |
| `POST /users/password` | `{ id, password }` → `auth.admin.updateUserById` |
| `POST /users/remove` | `{ id }` → borra de `team_members` y de Auth. Se niega si es el último `owner` o si es uno mismo |

Pantalla: tarjeta "Usuarios" en Ajustes, lista más un formulario de alta.

### 5.4 [MEDIA] El grupo de avisos hay que escribirlo con su id interno

`pages/Studio.jsx:93-100` pide *"id del chat, ej. 1203…@g.us"*. Ningún dueño
sabe eso ni tiene cómo averiguarlo. WAHA lista los grupos de la sesión:
`GET /api/{session}/groups?exclude=participants` devuelve `[{ id, subject }]`.

`providers/waha.ts`:

```ts
/** Los grupos del número conectado, para elegir el de avisos sin saber su id. */
async listGroups(): Promise<Array<{ id: string; name: string }>> {
  const { session } = await this.cfg()
  const res = await this.call<Array<{ id: string; subject?: string }>>(
    `/api/${encodeURIComponent(session)}/groups?exclude=participants`,
    undefined,
    'GET',
  )
  return (res ?? []).map((g) => ({ id: g.id, name: g.subject ?? g.id }))
}
```

Ruta `GET /api/panel/groups`, y en Studio el campo pasa a ser un `<select>`
con los grupos (más la opción "ninguno"). Si WhatsApp no está conectado, el
select dice *"Conectá el número para elegir el grupo"*.

### 5.5 Lo que ya está bien y no hay que tocar

Prompts por sección y por canal, editables (Studio). Las tres listas
(Ajustes). Módulos por bandera. La decisión en JSON con las guardas. La
cola única. Los avisos por episodio. Todo eso es la parte buena del
producto y la que se enseña.

---

## 6. Documentación y repo

| Dónde | Qué pasa | Arreglo |
|---|---|---|
| `README.md:8-9` | *"Estado: en construcción… arranca con la tanda 1"* | Ya hay tanda 2 completa. Reescribir "Arranque" con el asistente del panel |
| `README.md:53-58`, `PLAN.md:58`, `DECISIONES.md:44`, `DEPLOY.md:56` | "5 a 7 dólares" | 10 a 15 con WAHA (punto 3.4) |
| `docs/DEPLOY.md` | pide cargar todas las variables y aplicar migraciones a mano | reemplazar por el del punto 2.4 |
| `packages/db/README.md:15-19` | lista solo 0001 y 0002 | tabla completa 0001-0010 |
| `docs/PLAN.md:69-70` | "confirmar si la versión libre maneja imágenes y audios" | cerrada: sí, desde WAHA 2026.6.1 |
| `docs/PORTEO.md` tanda 2 | "instalador completo" marcado | agregar la línea del asistente del panel y marcar el de terminal como "solo desarrollo" |
| `CLAUDE.md` | no dice nada de variables de entorno | regla 11 (punto 1.2) |
| `package.json` | no hay un comando único de verificación | `"check": "npm run type-check && npm run build"` y que `CLAUDE.md` pida ese |
| git | 10 archivos sin commitear | commit "Tanda 3: módulos, menú dinámico, Ajustes; carga del .env; arreglo 0001" antes de empezar |

---

## 7. En qué orden

Cada tanda se puede pedir tal cual: *"Implementá la tanda A de
docs/AUDITORIA.md"*. Dentro de cada una, el orden es el que está.

**Tanda A — sin esto no se puede vender** (seguridad y configuración)

1. Commit de lo pendiente.
2. 4.4 — `0008_equipo.sql` + middleware. Hoy la base es pública para quien se registre.
3. 4.1 — filtro de grupos en `parseWebhook`.
4. 1.3 a 1.9 — `0007_settings.sql`, `settings.ts`, `env.ts` a tres variables,
   `/config.js`, tarjetas de claves en Conexión y Studio, tiempos en Ajustes.
5. 4.3 — secreto del webhook generado y obligatorio (sale casi solo del paso anterior).
6. 4.2 — `recentlySentByUs` en el eco.
7. 4.9 — sin clave, los turnos esperan.
8. `npm run check`, probar local con el número conectado a un WAHA de prueba:
   mensaje → respuesta → eco no pausa → aviso al grupo no crea conversación.

**Tanda B — instalación sin terminal**

1. 2.2 — `0010_instalador.sql`, `routes/install.ts`, `pages/Instalar.jsx`,
   siembras a `packages/core/src/seeds.js`.
2. 2.3 — `setup.mjs` reducido, `db-sql.mjs`, sacar `pg`.
3. 2.4 y punto 6 — `DEPLOY.md`, `README.md`, costos, `CLAUDE.md`.

**Tanda C — el panel completo**

1. 5.4 — grupo de avisos desde una lista.
2. 5.3 — usuarios.
3. 5.1 — los dos mensajes fijos a Studio.
4. 5.2 — ver lo que lee la IA, probar clave, probar seguimientos.
5. 4.6 — zona horaria como lista.
6. 4.10 — franja de estado en el panel.

**Tanda D — robustez y prolijidad**

4.5, 4.7, 4.8 (`0009_robustez.sql`), 4.11, 4.12, 4.13, 4.14.

Después de las cuatro tandas sigue la Tanda 3 del `PORTEO.md` (módulos
`hours`, `stock`, `payments`, `vision`, `audio`, `team`), que ya arranca
sobre una base que un alumno puede instalar solo.
