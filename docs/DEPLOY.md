# Poner el sistema en línea

Dos cuentas y un chip: **Supabase** (la base y el login) y **Railway** (el
servidor y el puente de WhatsApp). Primero creá tu copia del repo siguiendo
[PRIMEROS_PASOS.md](PRIMEROS_PASOS.md). Reservá tiempo para configurar y probar:
abrir el panel no significa que el bot esté listo para clientes.

El orden importa: primero el panel y el simulador, después WhatsApp. Así ves
a tu agente conversar antes de tocar un teléfono.

Railway es lo recomendado. Render sirve igual; lo único que cambia es que su
plan gratuito duerme el servicio, y un servicio dormido no manda seguimientos
ni se da cuenta de que el número se desconectó.

Si ya administrás un servidor propio, el repo también trae `Dockerfile` y
`docker-compose.yml` para correr el motor y el puente en la misma máquina,
con Docker o Portainer: [SERVIDOR_PROPIO.md](SERVIDOR_PROPIO.md). El paso 1
(Supabase) es el mismo para los dos caminos.

---

## 1. Supabase — la base

1. https://supabase.com → **New project**. Elegí la región más cercana.
   Usá un proyecto nuevo y dedicado a este negocio.
2. **Settings → API** → copiá la **Project URL**.
3. Arriba a la derecha, tu avatar → **Account → Access Tokens → Generate new
   token**. Ponele un nombre ("bot") y copiá el token: empieza con `sbp_` y
   se muestra una sola vez.

   Con ese token el servidor hace el resto: busca las claves del proyecto,
   crea las tablas y apaga los registros abiertos de Auth, para que nadie
   pueda crearse un usuario por su cuenta. Y te sirve después para que tu
   herramienta de IA siga mejorando el sistema contra tu misma base.
   Es un token de cuenta, con alcance mayor que este proyecto. Guardalo solo
   en Variables del servidor o en `.env`; nunca en GitHub ni capturas.
   El modo manual de abajo permite operar con claves de un solo proyecto.

## 2. Railway — el servidor

1. https://railway.app → **New Project → Deploy from GitHub repo** → tu copia
   de este repo. Si es privada y no aparece en la lista, tocá
   **Configure GitHub App** y dale acceso a ese repositorio.
   Railway detecta que es Node y usa `railway.json`: la raíz del servicio es
   la **raíz del repo**, no `apps/bot`. Usa Node 24, instala con `npm ci` y
   compila bot y panel. Conservá una sola réplica y dejá apagada la opción
   de suspender el servicio por inactividad.
2. Pestaña **Variables → Raw Editor** → pegá esto con tus dos valores:

   ```
   SUPABASE_URL=https://TU_PROYECTO.supabase.co
   SUPABASE_ACCESS_TOKEN=sbp_...
   ```

   **No cargues `PORT`.** Railway la inyecta sola y pisarla rompe el despliegue.
   No hay más variables: todo lo demás se configura desde el panel.

3. **Settings → Networking → Generate Domain**. Esa es la URL de todo: del
   panel, del webhook y de la API.
4. Abrí la URL. Las tablas ya se crearon al arrancar; el asistente te pide
   el nombre del negocio, tu usuario y **el mismo token `sbp_`** que pegaste
   en Railway. Queda oculto mientras lo escribís y no se guarda: sirve para
   confirmar que el panel es tuyo y no de alguien que encontró la dirección
   antes. Listo: entrás al panel. Empieza en **modo prueba**, sin números
   autorizados.

## 3. Panel — tu agente en el simulador

1. **Studio → Modelo de IA**: cargá tu clave y tocá **Probar clave y modelo**.
   Para Gemini: https://aistudio.google.com/apikey. Una clave no asegura cuota
   gratis ni acceso a todos los modelos; verificá la cuenta y la facturación.
2. **Studio → El prompt del bot**: escribí el objetivo, la información, los
   datos a guardar y cuándo derivar. Cómo, en [PROMPTS.md](PROMPTS.md).
3. **Probar el bot**: conversá como si fueras un cliente. Revisá la respuesta,
   la ficha y la derivación. El simulador no guarda leads ni envía mensajes.

## 4. Railway — el puente de WhatsApp (WAHA)

El puente es el servicio que maneja la sesión de WhatsApp Web. Va en el
**mismo proyecto** de Railway, como un segundo servicio.

<!--
  PLANTILLA_WAHA: cuando la plantilla esté publicada en Railway, reemplazá
  este comentario por el botón y dejá los pasos de abajo como alternativa:

  **Con un botón:** en tu proyecto de Railway, **+ New → Template** y buscá
  la plantilla, o usá [![Deploy on Railway](https://railway.com/button.svg)](URL_DE_LA_PLANTILLA).
  Viene con la versión fijada, el volumen, el puerto y las claves generadas.
  Después seguí en el paso 4 de esta lista (dominio) si no quedó creado.
-->

1. **+ New → Docker Image** → `devlikeapro/waha:latest-2026.8.2`.
   Es la versión con la que se preparó esta entrega. Usá una versión fija, no
   `latest`: esa etiqueta cambia sin avisar entre instalaciones.
2. **Variables → Raw Editor**, con dos claves largas inventadas por vos:

   ```
   WHATSAPP_API_KEY=una-clave-larga-y-guardala
   WAHA_DASHBOARD_PASSWORD=otra-clave-larga
   ```

   La primera es la que después pegás en el panel. La segunda protege el
   tablero propio de WAHA, que queda publicado en su dominio aunque no lo uses:
   el QR se escanea desde tu panel. El motor `WEBJS` ya es el predeterminado.
3. **Settings → Volumes → Add Volume** → mount path `/app/.sessions`.
   **Sin esto, cada redeploy del puente pide escanear el QR de nuevo.**
4. **Settings → Networking → Generate Domain**. Cuando pregunte el puerto:
   **3000**.
   Este servicio usa la imagen Docker; no lleva `npm start`, el build del
   repo ni las variables de Supabase.

## 5. Conectar WhatsApp

1. Panel → **Conexión**: pegá la URL del puente (el dominio del paso anterior)
   y la clave (`WHATSAPP_API_KEY`). Tocá **Probar conexión**.
2. En **Modo prueba**, cargá el número de OTRO teléfono que usarás como cliente
   y guardá. Mantené el modo prueba prendido.
3. **Arrancar la sesión** → escaneá el QR con el número **DEDICADO** del
   negocio (WhatsApp → Dispositivos vinculados → Vincular dispositivo).
4. Panel → **Studio**: elegí el grupo de avisos del equipo (aparece la lista
   de grupos del número conectado).
5. Escribile al número del negocio desde el teléfono autorizado. Después seguí
   [PRUEBAS.md](PRUEBAS.md) con teléfonos reales. Revisá los links y apagá
   el modo prueba cuando todas las verificaciones estén completas.

---

## Modo manual sin token de cuenta

Cargá en Railway, en vez del token, las dos claves del proyecto
(Settings → API Keys, claves legacy `anon` y `service_role`):

```
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Con eso el servidor no puede crear tablas: el asistente te muestra el SQL y
lo pegás vos en Supabase → SQL Editor → Run (un solo paste, y otro por cada
actualización que traiga migraciones). Quitá o dejá vacío `SUPABASE_ACCESS_TOKEN`:
si existe, el servidor intentará usarlo para administrar la base.

Sin token, el servidor tampoco puede apagar los registros abiertos. Antes de
pegar el SQL, en Supabase → **Authentication → Sign In / Providers**, desactivá
**Allow new users to sign up**. La `service_role` es privada; la `anon` es la
clave pública que usa el panel.

---

## Cosas que hay que saber

### Lo que cuesta

Railway cobra por uso; el plan Hobby incluye cinco dólares de uso por mes.

| Servicio | Por mes, aproximado |
|---|---|
| Servidor del bot | 3 a 5 dólares |
| Puente WAHA (corre un Chromium) | 5 a 8 dólares |
| Volumen del puente | menos de 1 dólar |
| Supabase | gratis para empezar |
| Gemini | centavos por conversación |

Estos valores son una **estimación inicial**, no una medición ni un precio
cerrado del repo. Medí tu instalación y definí quién paga. Railway Hobby cuesta
USD 5/mes e incluye USD 5 de recursos; el exceso se suma según consumo.
[Planes de Railway](https://docs.railway.com/pricing/plans).
Consultá también la [tarifa de IA](https://ai.google.dev/gemini-api/docs/pricing).

### Una sola réplica, siempre

`railway.json` fija `numReplicas: 1` y **no hay que subirlo**. Todo el sistema
manda los mensajes por una única cola, de a uno y con pausas, justamente para
que WhatsApp no bloquee el número. Dos réplicas son dos colas mandando en
paralelo: se pierde la protección entera y el número queda expuesto.

### El plan tiene que estar siempre encendido

El bot espera antes de contestar, manda con pausas y corre crons. Nada de eso
funciona en un servicio que se duerme ni en funciones serverless.

### Supabase gratis se pausa

El plan gratuito de Supabase **pausa el proyecto después de una semana sin
actividad**. Una instalación de aprendizaje puede pausarse; se reactiva desde
el panel de Supabase. Los planes de pago tienen otro régimen de respaldos.
Consultá [pausas](https://supabase.com/docs/guides/platform/free-project-pausing)
y [respaldos](https://supabase.com/docs/guides/platform/backups).

### Un proyecto de Railway por negocio

Para un segundo cliente repetí esta guía con otro proyecto de Railway, otro
proyecto de Supabase y otro número. Pueden desplegar la misma copia del repo:
la configuración de cada negocio vive en su base, no en el código. Tené en
cuenta que un push a esa copia redespliega a todos los que la usan.

### Actualizar

Cada push a la rama conectada de tu copia redespliega solo. Si trae cambios en
la base, el servidor los aplica al arrancar (con el token). Si por algo quedó
algo pendiente, el panel muestra una franja *"Hay cambios pendientes en la
base de datos"* con el botón **Aplicar**. Si algo sale mal, Railway guarda
los despliegues anteriores y permite volver al código anterior desde Deployments.
**Eso no revierte las migraciones de Supabase.**

Tu copia no recibe sola las versiones nuevas del motor. Cómo incorporarlas:
[Actualizar a una versión nueva](OPERACION.md#actualizar-a-una-versión-nueva).

### Respaldos

Los datos están en Supabase, no en Railway: el servidor no guarda nada propio y
se puede borrar y volver a crear sin perder una conversación. La sesión de
WhatsApp vive en el volumen del puente.

### Registros

Todo sale por la salida estándar y se ve en la pestaña Deployments de Railway.
Si el servidor no arranca, ahí está el motivo: casi siempre es una de las dos
variables que falta o el token que no es válido.
