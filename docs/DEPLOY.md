# Poner el sistema en línea

Dos cuentas y un chip: **Supabase** (la base y el login) y **Railway** (el
servidor y el puente de WhatsApp). Primero creá tu copia del repo siguiendo
[PRIMEROS_PASOS.md](PRIMEROS_PASOS.md). Reservá tiempo para configurar y probar:
abrir el panel no significa que el bot esté listo para clientes.

Railway es lo recomendado. Render sirve igual; lo único que cambia es que su
plan gratuito duerme el servicio, y un servicio dormido no manda seguimientos
ni se da cuenta de que el número se desconectó.

---

## 1. Supabase — la base

1. https://supabase.com → **New project**. Elegí la región más cercana.
   Usá un proyecto nuevo y dedicado. En **Authentication → Sign In / Providers**,
   desactivá **Allow new users to sign up** antes de continuar.
2. **Settings → API** → copiá la **Project URL**.
3. Arriba a la derecha, tu avatar → **Account → Access Tokens → Generate new
   token**. Ponele un nombre ("bot") y copiá el token: empieza con `sbp_` y
   se muestra una sola vez.

   Con ese token el servidor hace el resto: busca las claves del proyecto,
   crea las tablas y apaga los registros abiertos. Y te sirve después para
   que tu herramienta de IA siga mejorando el sistema contra tu misma base.
   Es un token de cuenta, con alcance mayor que este proyecto. Guardalo solo
   en Variables del servidor o en `.env`; nunca en GitHub ni capturas.
   El modo manual de abajo permite operar con claves de un solo proyecto.

## 2. Railway — el servidor

1. https://railway.app → **New Project → Deploy from GitHub repo** → tu fork
   de este repo. Detecta que es Node y usa `railway.json`.
   La raíz del servicio es la **raíz del repo**, no `apps/bot`. Usa Node 24,
   instala con `npm ci` y compila bot y panel. Conservá una sola réplica y
   desactivá la opción de suspender el servicio por inactividad.
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
   el nombre del negocio, tu usuario, y los últimos 8 caracteres del
   token (para confirmar que sos vos). Listo: entrás al panel.
   Empieza en **modo prueba**, sin números autorizados. Ya podés configurar
   Studio y Probar el bot antes de crear WAHA.

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
   WAHA_PRINT_QR=False
   ```

3. **Settings → Volumes → Add Volume** → mount path `/app/.sessions`.
   **Sin esto, cada redeploy del puente pide escanear el QR de nuevo.**
4. **Settings → Networking → Generate Domain**. Cuando pregunte el puerto:
   **3000**.
   Este servicio usa la imagen Docker; no lleva `npm start`, el build del
   repo ni las variables de Supabase. Guardá la versión y el digest de WAHA
   que pruebes y fijá ese digest después de validar: la imagen sin etiqueta
   puede cambiar entre instalaciones.

## 4. Conectar

1. Panel → **Conexión**: pegá la URL del puente y la clave
   (`WHATSAPP_API_KEY`). Tocá **Probar conexión**.
   En **Modo prueba**, cargá el número de OTRO teléfono que usarás como cliente
   y guardá. Mantené el modo prueba prendido.
2. **Arrancar la sesión** → escaneá el QR con el número **DEDICADO** del
   negocio (WhatsApp → Dispositivos vinculados → Vincular dispositivo).
3. Panel → **Studio**: cargá tu clave de IA y tocá **Probar clave y modelo**.
   Para Gemini: https://aistudio.google.com/apikey. Una clave no asegura cuota
   gratis ni acceso a todos los modelos; verificá la cuenta y la facturación.
4. Panel → **Studio**: elegí el grupo de avisos del equipo (aparece la lista
   de grupos del número conectado).
5. Probá tu objetivo y los seguimientos en **Probar el bot**. Después seguí
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
si existe, el servidor intentará usarlo para administrar la base. Desactivá
**Allow new users to sign up** antes de pegar el SQL. La `service_role` es privada;
la `anon` es la clave pública que usa el panel.

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

### Actualizar

Cada push a `main` redespliega solo. Si la actualización trae cambios en la
base, el servidor los aplica al arrancar (con el token). Si por algo quedó
algo pendiente, el panel muestra una franja *"Hay cambios pendientes en la
base de datos"* con el botón **Aplicar**. Si algo sale mal, Railway guarda
los despliegues anteriores y permite volver al código anterior desde Deployments.
**Eso no revierte las migraciones de Supabase.** Seguí [OPERACION.md](OPERACION.md)
antes de actualizar una instalación con datos reales.

### Respaldos

Los datos están en Supabase, no en Railway: el servidor no guarda nada propio y
se puede borrar y volver a crear sin perder una conversación. La sesión de
WhatsApp vive en el volumen del puente.

### Registros

Todo sale por la salida estándar y se ve en la pestaña Deployments de Railway.
Si el servidor no arranca, ahí está el motivo: casi siempre es una de las dos
variables que falta o el token que no es válido.
