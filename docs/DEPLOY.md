# Poner el sistema en línea

Un solo servicio: el mismo proceso sirve el panel, recibe el webhook de
WhatsApp y corre los crons. Una URL, un lugar donde mirar los registros.

**Railway** es lo recomendado. Render sirve igual; lo único que cambia es que
su plan gratuito duerme el servicio, y un servicio dormido no manda
seguimientos ni se da cuenta de que el número se desconectó.

---

## Los siete pasos

1. **Creá tu proyecto de Supabase** y aplicá las migraciones de
   `packages/db/migrations` en orden, desde el editor SQL.

2. **En Railway**: New Project → Deploy from GitHub repo → elegí este repo.
   Detecta que es Node y usa `railway.json`. No hay nada que configurar.

3. **Cargá las variables** en Variables. Son las de `.env.example`. Las dos
   imprescindibles para que arranque son `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY`; si falta alguna, el servidor no levanta y te
   dice cuál.

   **No cargues `PORT`.** Railway la inyecta sola y pisarla rompe el despliegue.

4. **Generá el dominio**: Settings → Networking → Generate Domain. Te queda algo
   como `tu-proyecto.up.railway.app`. Esa es la URL de todo: del panel, del
   webhook y de la API.

5. **Verificá que esté vivo**: entrá a `https://tu-dominio/health`. Tiene que
   responder `ok: true` y decirte si WhatsApp está configurado.

6. **Entrá al panel** en la raíz del dominio y conectá el número escaneando el
   código QR. El panel deja el webhook apuntado solo.

7. **Mandate un mensaje** desde otro teléfono. Si contesta, terminaste.

---

## Cosas que hay que saber

### Una sola réplica, siempre

`railway.json` fija `numReplicas: 1` y **no hay que subirlo**. Todo el sistema
manda los mensajes por una única cola, de a uno y con pausas, justamente para
que WhatsApp no bloquee el número. Dos réplicas son dos colas mandando en
paralelo: se pierde la protección entera y el número queda expuesto.

Si algún día hace falta más capacidad, se resuelve moviendo la cola a la base,
no agregando réplicas.

### El plan tiene que estar siempre encendido

El bot espera antes de contestar, manda con pausas y corre crons. Nada de eso
funciona en un servicio que se duerme ni en funciones serverless. Contá entre
cinco y siete dólares por mes por instalación y decilo antes de vender, no
después.

### Actualizar

Cada push a `main` redespliega solo. Si algo sale mal, Railway guarda los
despliegues anteriores y se vuelve atrás desde el panel de Deployments.

### Respaldos

Los datos están en Supabase, no en Railway: el servidor no guarda nada propio y
se puede borrar y volver a crear sin perder una conversación. Los respaldos se
configuran del lado de Supabase, y es responsabilidad de quien instala.

### Registros

Todo sale por la salida estándar y se ve en la pestaña Deployments de Railway.
Si el servidor no arranca, ahí está el motivo: casi siempre es una variable que
falta.
