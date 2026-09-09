# Servidor propio con Docker y Portainer

El otro camino para poner el sistema en línea. En vez de alquilar dos
servicios en una plataforma, corrés el motor y el puente de WhatsApp en
una máquina tuya: **un stack, dos contenedores**.

Conviene cuando ya administrás un servidor, cuando vas a tener varios
negocios (el segundo y el tercero salen casi gratis) o cuando querés que
el puente no esté publicado en internet. Si no querés ser el
administrador del servidor, quedate con [DEPLOY.md](DEPLOY.md): ahí no
hay dominios, certificados ni actualizaciones de sistema a tu cargo.

Lo que cambia respecto de Railway:

- **El puente no sale a internet.** WAHA vive en la red interna del stack
  y solo lo alcanza el bot. No necesita dominio ni certificado: el QR se
  escanea desde el panel.
- **El dominio y el certificado son tuyos.** Los pone tu proxy.
- **La URL pública se carga a mano** una vez, en el panel. Railway y
  Render la informan solos; un servidor propio, no.

---

## Antes de empezar

- Un servidor con Docker y Portainer. Con **2 GB de RAM** alcanza para
  los dos contenedores; con 4 GB compilás cómodo y te queda margen.
- Un dominio apuntando a ese servidor y un proxy que resuelva el
  certificado (Nginx Proxy Manager, Traefik o Caddy).
- Tu fork del repo en GitHub. Si todavía no lo tenés,
  [PRIMEROS_PASOS.md](PRIMEROS_PASOS.md).
- El proyecto de Supabase y el token `sbp_`: es el **paso 1** de
  [DEPLOY.md](DEPLOY.md), igual para los dos caminos.

## 1. El nombre

Un registro **A** de `bot.tudominio.com` a la IP del servidor. Uno solo:
en este stack el puente no se publica, así que si ya tenías un nombre
apuntado a WAHA, podés reusar ese mismo para el bot.

## 2. El stack en Portainer

**Stacks → Add stack → Repository**:

| Campo | Valor |
|---|---|
| Repository URL | la de tu fork |
| Reference | `refs/heads/main` |
| Compose path | `docker-compose.yml` |

En **Environment variables**, una por una:

```
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ACCESS_TOKEN=sbp_...
WHATSAPP_API_KEY=inventá-una-clave-larga-y-guardala
```

Opcionales: `BOT_PORT` si el 3000 del servidor ya está ocupado por otro
stack, y `WHATSAPP_DEFAULT_ENGINE` si probaste otro motor de WAHA.

El token `sbp_` va **acá y en ningún otro lado**: nunca en el repo, que es
público o compartido, ni en capturas de la clase.

**Deploy the stack.** La primera vez tarda unos minutos: el servidor baja
las dependencias y compila el panel y el motor. Las siguientes son mucho
más rápidas porque Docker reutiliza las capas.

## 3. Que se actualice solo

En el mismo formulario, **GitOps updates**. Dos formas:

- **Polling**, cada 5 minutos. Es la simple: no hay que tocar GitHub.
- **Webhook**: Portainer te da una URL y la pegás en GitHub →
  *Settings → Webhooks*. Se actualiza en el momento del push y no
  consulta al pedo el resto del día.

Con cualquiera de las dos, cada push a tu fork reconstruye la imagen y
reemplaza el contenedor. Si la actualización trae cambios en la base, el
servidor los aplica al arrancar (con el token).

Ojo con lo que esto significa: **un push roto deja el bot abajo** hasta
que lo arregles. Los turnos que quedaron sin contestar se recuperan al
arrancar de nuevo, pero mientras tanto nadie contesta. Corré
`npm run check` antes de pushear a una instalación con clientes.

Si después de un push ves que sigue corriendo el código viejo, redesplegá
el stack a mano desde Portainer y revisá los registros del build.

## 4. El dominio al bot

En tu proxy, un host nuevo: `bot.tudominio.com` hacia el puerto **3000**
del servidor (o el `BOT_PORT` que hayas puesto), con certificado y
redirección a https.

El puente **no** lleva host en el proxy. Esa es toda la ganancia de
seguridad de este camino: dejar de tener un WAHA publicado cuya única
defensa es una clave en un header.

## 5. Instalar y conectar

1. Abrí `https://bot.tudominio.com`. Las tablas ya se crearon al arrancar;
   el asistente te pide el nombre del negocio, tu usuario y los últimos 8
   caracteres del token.
2. Panel → **Conexión**:
   - **URL del puente**: `http://waha:3000` — el nombre del servicio en el
     stack, no un dominio. Así viaja por la red interna de Docker.
   - **Clave**: la `WHATSAPP_API_KEY` que pusiste en el stack.
   - **URL pública de este panel**: `https://bot.tudominio.com`.
     **Este es el campo que no hay que olvidarse.** Con él, el webhook
     queda registrado en https y los avisos al grupo del equipo llevan el
     link a la conversación. Sin él, el servidor adivina la URL desde el
     pedido del navegador y le sale `http://`, porque el proxy le entrega
     el tráfico sin cifrar: el puente termina avisando a una dirección
     que redirige, y el aviso se pierde.
3. De acá en adelante es igual que en Railway: modo prueba, arrancar la
   sesión, escanear el QR, cargar la clave de IA. Seguí desde el **paso 4**
   de [DEPLOY.md](DEPLOY.md).

---

## Cosas que hay que saber

### Una sola réplica, también acá

Nada de `--scale bot=2`. Todo el sistema manda por una única cola, de a
uno y con pausas, para que WhatsApp no bloquee el número. Dos contenedores
del motor son dos colas mandando en paralelo.

### Memoria

El motor come poco: unos 200 MB. El puente con el motor `WEBJS` corre un
Chromium y se lleva cerca de 1 GB. La compilación pide alrededor de 1 GB
libre; si el servidor es de 2 GB y el build muere sin explicación, casi
siempre es eso: agregale swap o construí la imagen en otra máquina.

### Respaldos

Los datos están en Supabase, no en el servidor. Lo único propio de esta
máquina es el volumen `waha-sessions`, que guarda la sesión de WhatsApp:
si lo perdés, se vuelve a escanear el QR y listo. El contenedor del motor
no guarda nada y se puede borrar y volver a crear sin perder una
conversación.

### Registros

Portainer → *Containers* → el contenedor → *Logs*. Si el motor no
arranca, ahí está el motivo: casi siempre es una de las dos variables de
Supabase que falta o el token que no es válido.

### Fijá la versión del puente

`docker-compose.yml` trae `devlikeapro/waha:latest` para que la primera
instalación sea fácil. Antes de ponerlo con clientes, cambiá esa línea por
el digest de la versión que probaste (`devlikeapro/waha@sha256:...`): la
etiqueta `latest` cambia sin avisar y una actualización del puente en el
medio de una conversación no es algo que quieras descubrir en vivo.
