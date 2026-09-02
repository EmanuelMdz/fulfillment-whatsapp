# Poner el sistema en línea

Dos cuentas y un chip: **Supabase** (la base y el login) y **Railway** (el
servidor y el puente de WhatsApp). Veinte minutos, sin terminal.

Railway es lo recomendado. Render sirve igual; lo único que cambia es que su
plan gratuito duerme el servicio, y un servicio dormido no manda seguimientos
ni se da cuenta de que el número se desconectó.

---

## 1. Supabase — la base

1. https://supabase.com → **New project**. Elegí la región más cercana.
2. **Settings → API** → copiá la **Project URL**.
3. Arriba a la derecha, tu avatar → **Account → Access Tokens → Generate new
   token**. Ponele un nombre ("bot") y copiá el token: empieza con `sbp_` y
   se muestra una sola vez.

   Con ese token el servidor hace el resto: busca las claves del proyecto,
   crea las tablas y apaga los registros abiertos. Y te sirve después para
   que tu Claude siga mejorando el sistema contra tu misma base.

## 2. Railway — el servidor

1. https://railway.app → **New Project → Deploy from GitHub repo** → tu fork
   de este repo. Detecta que es Node y usa `railway.json`.
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
   el pack, el nombre del negocio, tu usuario, y los últimos 8 caracteres del
   token (para confirmar que sos vos). Listo: entrás al panel.

## 3. Railway — el puente de WhatsApp (WAHA)

El puente es el servicio que maneja la sesión de WhatsApp Web. Va en el
**mismo proyecto** de Railway, como un segundo servicio.

1. **+ New → Docker Image** → `devlikeapro/waha`.
2. **Variables → Raw Editor**:

   ```
   WHATSAPP_API_KEY=inventá-una-clave-larga-y-guardala
   WAHA_DASHBOARD_USERNAME=admin
   WAHA_DASHBOARD_PASSWORD=inventá-otra
   WHATSAPP_DEFAULT_ENGINE=WEBJS
   ```

3. **Settings → Volumes → Add Volume** → mount path `/app/.sessions`.
   **Sin esto, cada redeploy del puente pide escanear el QR de nuevo.**
4. **Settings → Networking → Generate Domain**. Cuando pregunte el puerto:
   **3000**.

## 4. Conectar

1. Panel → **Conexión**: pegá la URL del puente y la clave
   (`WHATSAPP_API_KEY`). Tocá **Probar conexión**.
2. **Arrancar la sesión** → escaneá el QR con el número **DEDICADO** del
   negocio (WhatsApp → Dispositivos vinculados → Vincular dispositivo).
3. Panel → **Studio**: pegá la clave de Gemini (gratis en
   https://aistudio.google.com/apikey). Tocá **Probar clave y modelo**.
4. Panel → **Studio**: elegí el grupo de avisos del equipo (aparece la lista
   de grupos del número conectado).
5. Panel → **Probar el bot**: charlá. Después mandate un WhatsApp desde otro
   teléfono. Si contesta, terminaste.

---

## Si preferís no darle el token de tu cuenta

Cargá en Railway, en vez del token, las dos claves del proyecto
(Settings → API):

```
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Con eso el servidor no puede crear tablas: el asistente te muestra el SQL y
lo pegás vos en Supabase → SQL Editor → Run (un solo paste, y otro por cada
actualización que traiga migraciones). Y apagá a mano **Authentication →
Sign In / Providers → "Allow new users to sign up"**.

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

Contá **entre diez y quince dólares por mes por instalación** y decilo antes
de vender, no después.

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
actividad**. Un bot con tráfico nunca llega a eso; una instalación de prueba
sí. Se despierta desde el panel de Supabase. Y no tiene respaldos
automáticos: eso es del plan Pro.

### Actualizar

Cada push a `main` redespliega solo. Si la actualización trae cambios en la
base, el servidor los aplica al arrancar (con el token). Si por algo quedó
algo pendiente, el panel muestra una franja *"Hay cambios pendientes en la
base de datos"* con el botón **Aplicar**. Si algo sale mal, Railway guarda
los despliegues anteriores y se vuelve atrás desde la pestaña Deployments.

### Respaldos

Los datos están en Supabase, no en Railway: el servidor no guarda nada propio y
se puede borrar y volver a crear sin perder una conversación. La sesión de
WhatsApp vive en el volumen del puente.

### Registros

Todo sale por la salida estándar y se ve en la pestaña Deployments de Railway.
Si el servidor no arranca, ahí está el motivo: casi siempre es una de las dos
variables que falta o el token que no es válido.
