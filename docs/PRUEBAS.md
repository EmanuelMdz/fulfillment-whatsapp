# Conectar y probar antes de entregar

El paso entre "el panel anda" y "se lo doy a un cliente". Son dos partes:
conectar el puente de WhatsApp, y pasar la lista de pruebas.

> **La versión corta de todo esto está adentro del panel**, en
> **Puesta en marcha** (abajo del menú): el mismo camino en cuatro fases,
> con un diagrama de cómo se conectan las piezas y una lista que se va
> tildando mientras instalás. Este documento es el detalle.

> **Para ver el panel lleno sin conectar nada** (mostrarlo en una clase, o
> a un cliente antes de instalarle): `npm run demo` carga cinco
> conversaciones de ejemplo con sus pedidos, casos de revisión y métricas
> de la semana. Requiere Supabase y el asistente terminado. `npm run demo:limpiar`
> borra solo datos con la marca de la demo nueva y destino `demo:`.
> No hay teléfonos reales ni seguimientos activos. Las demos antiguas con
> teléfonos `5989900…` se revisan a mano; no se borran por prefijo.

En Ainnovate no entregamos una instalación sin las trece pruebas de la
sección 4 en verde. Cada una existe porque algo salió mal alguna vez.

---

## 1. Levantar el puente

El puente (WAHA) es el servicio que sostiene la sesión de WhatsApp Web.
Hay dos formas de levantarlo, y conviene conocer las dos.

### Para probar: en tu computadora, con Docker

Sirve para aprender el circuito sin pagar nada y sin arriesgar el número
del cliente. Necesitás Docker Desktop instalado y corriendo.

```bash
docker run -d --name waha -p 127.0.0.1:3001:3000 -e WHATSAPP_API_KEY=REEMPLAZAR_POR_UNA_CLAVE_LARGA -e WHATSAPP_DEFAULT_ENGINE=WEBJS -e WAHA_PRINT_QR=False -v waha-sessions:/app/.sessions devlikeapro/waha
```

Reemplazá la clave antes de ejecutar. El comando en una línea funciona en
PowerShell, bash y zsh. Docker es opcional: si ya hay un puente adecuado,
reutilizalo. No hace falta para probar el panel y la IA.

Qué es cada cosa:

| Parte | Para qué |
|---|---|
| `-p 3001:3000` | El puente escucha en 3001 para no chocar con el bot, que usa el 3000 |
| `WHATSAPP_API_KEY` | La clave que después pegás en el panel |
| `WHATSAPP_DEFAULT_ENGINE=WEBJS` | El motor más probado; corre un Chromium adentro |
| `-v waha-sessions:/app/.sessions` | **Sin esto, cada reinicio pide el QR de nuevo** |

Después, en el panel → Conexión: URL `http://localhost:3001`, la clave, y
Probar conexión.

**Ojo con el webhook en local.** El puente le avisa al bot llamando a la
URL del bot. Dentro de Docker, `localhost` es el contenedor, no tu computadora.
Con Docker Desktop en Windows/macOS, cargá **Conexión → Avanzado → URL pública**
con `http://host.docker.internal:3000` antes de arrancar la sesión. En Linux
agregá `--add-host=host.docker.internal:host-gateway` al comando Docker.
Esa dirección sirve para la prueba local; los links internos pueden no abrir
desde el teléfono. Para probar también los links, usá un túnel accesible desde
ambos lados.

Si WAHA está en Railway y el bot en tu computadora, necesitás un túnel
(`cloudflared tunnel --url http://localhost:3000`) y cargar su URL en ese campo.
Cada vez que cambie la URL, guardá y tocá **Arrancar la sesión** para actualizar
el webhook. No arranques otro bot contra la base que ya usa Railway.

Para detenerlo conservando la sesión y retomarlo después:

```bash
docker stop waha
docker start waha
```

### Para el cliente: en Railway

Es lo que está en `docs/DEPLOY.md`, sección 3: mismo proyecto que el bot,
imagen `devlikeapro/waha`, las mismas variables, y **el volumen en
`/app/.sessions`**, que es lo que más se olvida.

---

## 2. Prender el modo prueba ANTES de escanear

Este es el paso que evita el peor momento de una instalación: el número
del negocio ya está vinculado, el prompt todavía no está afinado, y
escribe un cliente real. Sin esto, el bot le contesta cualquier cosa.

La instalación nueva ya empieza en modo prueba. Revisá que siga prendido.
Panel → **Conexión** → tarjeta **Modo prueba**:

1. Cargá tu número (el del teléfono con el que vas a probar), uno por
   línea. Como lo escribas: `099 123 456` o `+598 99 123 456`, da igual.
2. Marcá **Modo prueba prendido**.

Desde ahí, el bot **solo le contesta a esos números**. Lo que escriba
cualquier otro se guarda y aparece en Conversaciones —así el negocio no
pierde nada y una persona puede responder a mano desde el panel— pero el
bot se queda callado.

Mientras está prendido, el panel muestra una franja amarilla en todas las
pantallas. Es a propósito: **olvidarse el modo prueba prendido significa
un bot que ignora a los clientes reales**, y es más silencioso que tenerlo
apagado.

Se apaga al final, cuando pasaste las trece pruebas y el prompt está
listo.

---

## 3. Vincular el número

1. **Un chip dedicado.** Nunca el personal del dueño ni el tuyo. Si lo
   bloquean, se pierde ese número y nada más.
2. Panel → **Conexión** → pegá la URL del puente y la clave → **Probar
   conexión**. Tiene que decir "El puente responde y la clave es correcta".
3. **Arrancar la sesión** → aparece el QR (se renueva solo).
4. En el teléfono: WhatsApp → **Dispositivos vinculados** → Vincular
   dispositivo → escaneá.
5. La pastilla de arriba del panel pasa a **WhatsApp conectado** en verde.
   Puede tardar hasta dos minutos: el vigilante mira la sesión con esa
   frecuencia.

**Calentar el número.** Un chip nuevo que de golpe manda cincuenta
mensajes es exactamente lo que WhatsApp busca. En Ainnovate recomendamos:
la primera semana, conversaciones reales con conocidos, poco volumen, y
recién después conectarlo al negocio.

---

## 4. Las trece pruebas

Necesitás **dos teléfonos**: el del negocio (vinculado) y otro para hacer
de cliente. **Ese segundo es el que va en el modo prueba.** Anotá cuál
falla; el porqué está en la sección 5.

### El circuito básico

**1. Llega un mensaje.**
Desde el otro teléfono, escribile al número del negocio: "hola".
→ En el panel, pestaña Conversaciones, aparece el chat en unos segundos.

**2. El bot contesta.**
Esperá. El bot espera 90 segundos antes de responder (Ajustes → Avanzado)
para juntar los mensajes sueltos.
→ Llega la respuesta al teléfono, y en el panel se ve la burbuja del bot.

**3. No contesta tres veces a tres mensajes.**
Mandá tres mensajes seguidos, rápido: "hola", "estás?", "una consulta".
→ **Una sola respuesta**, que contesta todo junto. Si contesta tres veces,
el debounce no está funcionando.

**4. El eco no lo confunde.**
Después de que el bot conteste, mirá el panel.
→ El chat tiene que seguir en estado **Bot**, no en Humano. Si pasó a
Humano solo, el bot se confundió su propio mensaje con una persona (era
una carrera conocida; está cubierta, pero esta es la prueba real).

### Cuando entra una persona

**5. Responder desde el panel toma el control.**
En Conversaciones, escribile algo al cliente desde el panel.
→ El mensaje llega al teléfono del cliente, la burbuja queda tenue ("en
cola de envío") y después firme, y el chat pasa a **Humano**.

**6. Con un humano adentro, el bot se calla.**
Desde el teléfono del cliente, escribí otra cosa.
→ El bot **no** contesta. El mensaje se guarda y aparece en el panel.

**7. Responder desde el celular del negocio también toma el control.**
Devolvé el chat al bot ("Devolver al bot"), esperá que el cliente escriba
y el bot conteste. Ahora, desde el **teléfono del negocio**, contestale a
mano por WhatsApp.
→ El chat pasa a Humano solo, y el mensaje aparece en el panel.

**8. Devolver al bot no rebota.**
"Devolver al bot" en ese chat.
→ Vuelve a estado Bot y **se queda ahí**. Si rebota a Humano solo en
segundos, el watermark de handback está fallando.

### Derivación, pedidos y avisos

**9. Deriva cuando corresponde.**
Desde el cliente: "quiero hablar con una persona".
→ El bot contesta algo como "te paso con el equipo", el chat pasa a
Humano, y aparece en **Revisión** con su motivo.

**10. El grupo recibe el aviso.**
Con el grupo configurado (Studio → Grupo de avisos), repetí la prueba 9.
→ Llega **un** mensaje al grupo con el motivo y el link al chat. Un solo
mensaje: si llegan dos, la protección por episodio falla.

**11. El bot no le contesta al grupo.**
Escribí cualquier cosa en el grupo de avisos.
→ El bot **no** responde ahí, y el grupo **no** aparece en
Conversaciones. (Los grupos están filtrados; esta es la prueba.)

**12. Anota un pedido sin cerrarlo.**
Desde el cliente, pedí algo del catálogo y confirmá: "sí, dale".
→ El bot dice que quedó anotado (nunca "listo" ni "confirmado"), el
pedido aparece en Pedidos en la primera etapa, el chat pasa a Humano, y
el grupo recibe el aviso de pedido para confirmar.

### La caída

**12b. El modo prueba realmente filtra.**
Con el modo prueba prendido, escribile al número del negocio desde un
**tercer** teléfono (o pedile a alguien que le escriba).
→ El mensaje aparece en Conversaciones, y el bot **no** contesta. Si
contesta, el filtro no está funcionando y no podés conectar un número
real todavía.

**13. Si se cae, el panel avisa.**
Con todo andando, desconectá el número: en el teléfono, WhatsApp →
Dispositivos vinculados → cerrar la sesión. (O `docker stop waha`.)
→ En menos de dos minutos, el panel muestra en rojo **"El número está
desconectado"** y la pastilla de arriba se pone roja.
Volvé a vincular y confirmá que la franja desaparece.

---

## 5. Si algo falla

| Prueba | Dónde mirar |
|---|---|
| 1 (no llega el mensaje) | ¿El webhook apunta bien? Conexión → Avanzado lo muestra. Los registros del puente: `docker logs waha`. En Railway, la pestaña del servicio de WAHA. |
| 2 (no contesta) | La pastilla de IA arriba; Studio → bot prendido; Métricas → turnos caídos; los registros del bot (`[turno] falló`). |
| 3 (contesta tres veces) | Ajustes → Avanzado → espera antes de contestar. Menos de 30 segundos hace esto. |
| 4 (pasa a Humano solo) | Registros del bot: buscá `humano tomó la conversación`. |
| 5 (no sale el mensaje) | La cola: si el puente no está listo, los mensajes esperan. Registros: `[envío]`. |
| 8 (rebota) | Registros: `conversation.handback` seguido de `human_takeover` es el síntoma. |
| 10 (dos avisos) | La tabla `notification_episodes` en Supabase. |
| 12 (no crea el pedido) | El bot apuntó a algo que no está en el catálogo: mirá el detalle del caso en Revisión. |
| 12b (contesta igual) | Conexión → Modo prueba: ¿está tildado? ¿el número que probaste está en la lista por error? Registros: el turno queda como `turn.skipped` con motivo `modo_prueba`. |
| 13 (no avisa) | El vigilante corre cada dos minutos; esperá. Registros: `[conexión]`. |

Y siempre: **Métricas** primero, y `event_log` en Supabase filtrando por
`severity = 'error'`.

---

## 6. Antes de entregar

- [ ] Las trece pruebas en verde.
- [ ] **El modo prueba APAGADO.** Es el olvido más caro: el bot queda
      ignorando a todos los clientes y nadie se entera. El panel lo avisa
      en amarillo mientras está prendido.
- [ ] El prompt escrito para ese negocio (no el de fábrica) y las diez
      preguntas de `docs/PROMPTS.md` pasadas en Probar el bot.
- [ ] El catálogo cargado con la ficha de cada cosa.
- [ ] El grupo de avisos con el dueño adentro.
- [ ] Zona horaria y ventana nocturna correctas.
- [ ] El usuario del cliente creado en Ajustes → Usuarios, con su
      contraseña, y el tuyo aparte.
- [ ] El catálogo de ejemplo borrado.
- [ ] El cliente sabe tres cosas: que puede responder desde el panel o
      desde el celular y el bot se calla, que "Devolver al bot" lo
      destraba, y que si el panel se pone rojo hay que reconectar el
      número.
- [ ] Le dijiste cuánto cuesta por mes (entre diez y quince dólares) y
      quién lo paga.
