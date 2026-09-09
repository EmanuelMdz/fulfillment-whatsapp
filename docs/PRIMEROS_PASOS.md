# Tu primera instalación

El primer resultado es una conversación en el simulador guiada por tu prompt.
Todavía no necesitás vincular WhatsApp.

## 1. Duplicá el repo

En GitHub elegí **Fork → Create fork**, o **Use this template** si está habilitado.
Confirmá que estás trabajando en tu copia.

## 2. Prepará las cuentas

Creá un proyecto nuevo y vacío de Supabase, dedicado a esta instalación.
Prepará tu cuenta de Railway y una clave de Gemini u OpenAI con acceso a su API.
Las variables y el modo manual están en [DEPLOY.md](DEPLOY.md).

## 3. Instalá

En Railway, seguí los pasos 1 y 2 de [Deploy](DEPLOY.md).

En tu computadora, con Git y Node.js 24:

```bash
git clone URL_DE_TU_COPIA
cd nombre-del-repo
npm ci
npm run setup
npm run build
npm run doctor
npm run dev
```

Abrí http://localhost:3000. No levantes otro bot contra una base que ya usa Railway.

## 4. Completá el asistente

Ingresá nombre del negocio, zona horaria y tu email y contraseña.
Para verificar que sos el dueño, pegá los últimos ocho caracteres del token
cargado en el hosting. En modo manual, el asistente usa el código del SQL.

El panel empieza en modo prueba, sin números autorizados. No hay packs ni
catálogo para elegir.

## 5. Escribí tu prompt

En **Studio**, cargá la clave de IA y probá el modelo.
Después escribí el prompt siguiendo [PROMPTS.md](PROMPTS.md):

- Qué debe conseguir el agente.
- Qué información y links puede usar.
- Qué datos debe pedir y guardar.
- Cuándo pasar a una persona.
- Si hace seguimientos, cuántos y en qué momentos.

El prompt inicial no programa seguimientos hasta que definas sus reglas.

## 6. Probá

En **Probar el bot**, conversá como un lead. Revisá la respuesta, la ficha y
la derivación que propone. Probá también los seguimientos.
El simulador usa la API de IA, pero no guarda leads ni envía mensajes reales.

Opcional: `npm run demo` carga cinco ejemplos ficticios en una base ya instalada.

## 7. Conectá WhatsApp

Seguí los pasos 3 y 4 de [Deploy](DEPLOY.md).
Antes de escanear el QR del número dedicado, agregá el teléfono que hará de
lead en **Conexión → Modo prueba**. Conservá el modo prueba durante
[las verificaciones](PRUEBAS.md).

## Si te acompaña una IA

```text
Leé README.md, docs/GUIA.md y docs/PROMPTS.md.
Quiero adaptar mi agente de WhatsApp.
Mi negocio es: [...]
El objetivo del agente es: [...]
Guiame un paso por vez. Definí el objetivo, los datos y los seguimientos
en el prompt. Conservá el modo prueba y no arranques servicios duplicados
contra mi base.
```
