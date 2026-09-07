# Tu primera instalación

El objetivo inicial es ver al bot responder en el simulador con información de
tu negocio. Para ese resultado no necesitás conectar WhatsApp todavía.

## 1. Creá tu copia

1. Entrá al repo en GitHub con tu cuenta.
2. Elegí **Fork → Create fork**. Si el autor habilitó **Use this template**,
   también podés crear tu copia con ese botón.
3. Confirmá que arriba aparece **tu usuario / nombre del repo**. Los cambios
   y el despliegue se hacen desde esa copia.

Un fork conserva el vínculo con el original para recibir actualizaciones.
Descargar un ZIP sirve para leer o probar código, pero no te deja conectado al
flujo de despliegue de GitHub.

## 2. Prepará las cuentas

- **Supabase:** un proyecto nuevo y vacío, dedicado a esta instalación. Guardá
  la contraseña de la base en tu gestor; no es la contraseña del panel.
- **GitHub y Railway:** para el camino publicado. Railway necesita acceso a tu copia.
- **Proveedor de IA:** una clave de Gemini u OpenAI con acceso a su API.

Los costos y las variables están en [DEPLOY.md](DEPLOY.md). Evitá reutilizar
el Supabase de otro proyecto: el instalador crea tablas y configura Auth.

## 3. Elegí dónde ejecutarlo

### Railway

Seguí [DEPLOY.md, pasos 1 y 2](DEPLOY.md). Al terminar tenés una URL que abre el
asistente. Podés completar el panel y el simulador antes de crear WAHA.

### En tu computadora

Instalá Git y [Node.js 24 LTS](https://nodejs.org/en/download). Volvé a abrir la
terminal después de instalarlos. En Windows usá PowerShell; en macOS/Linux,
Terminal. Estos comandos funcionan en los tres.

En tu fork, botón **Code → HTTPS**, copiá la dirección y usala en lugar de
`URL_DE_TU_FORK`:

```bash
git clone URL_DE_TU_FORK
```

Entrá a la carpeta creada (`cd nombre-del-repo`). Debés ver `package.json`,
`README.md` y `.env.example`. Ejecutá:

```bash
npm ci
npm run setup
npm run build
npm run doctor
npm run dev
```

`setup` prepara `.env` y pide las variables que falten. Si usás el modo manual,
copiá `.env.example` a `.env` con tu editor y cargá las claves indicadas allí.
No compartas esa terminal mientras ingresás el token. `.env` no se sube a GitHub.

**Resultado esperado:** `doctor` muestra los controles en `OK`; el servidor
imprime que escucha en localhost:3000. Abrí esa dirección y dejá la terminal
corriendo. Para detener solo este servidor, `Ctrl+C` en esa misma terminal.

`doctor` comprueba formatos y archivos. El acceso a Supabase se verifica al
arrancar y en el asistente. Si modificás el panel, volvé a compilar o ejecutá
`npm run dev:panel` en otra terminal y abrí la URL que muestra Vite.

## 4. Completá el asistente

1. Elegí **General**, salvo que necesites las palabras iniciales de otro pack.
2. Escribí el nombre del negocio, zona horaria y símbolo de moneda.
3. Para aprender, podés cargar el catálogo de ejemplo. Sus precios y fichas son
   ficticios: reemplazalos antes de habilitar atención real.
4. Creá el usuario del dueño con email y contraseña de al menos ocho caracteres.
5. Pegá **solo los últimos ocho caracteres** del token cargado en el hosting.
   En modo manual, el asistente usa el código incluido en el SQL.

**Resultado esperado:** podés entrar y el panel muestra modo prueba. Todavía
no responde a ningún teléfono. Si hubo un error durante la instalación,
verificá el estado y reintentá con el mismo correo; no crees otro proyecto
por un error transitorio.

## 5. Conseguí la primera respuesta

1. **Studio:** cargá la clave, elegí proveedor/modelo y tocá **Probar clave y modelo**.
2. **Studio → Prompt:** describí tu negocio. Usá [PROMPTS.md](PROMPTS.md).
3. **Catálogo:** cargá al menos un producto o servicio con precio y ficha.
4. **Probar el bot:** preguntá por ese ítem, por algo fuera del catálogo y cómo
   hablar con una persona. Revisá la decisión que muestra el simulador.

**Resultado esperado:** una respuesta basada en tu catálogo y una derivación
cuando corresponde. El simulador consume la API de IA, pero no envía WhatsApp,
no crea pedidos ni programa seguimientos reales.

Para recorrer el panel con datos ficticios: `npm run demo`, solo en la base
de aprendizaje. La demo no reemplaza esta prueba de la IA.

## 6. Vinculá WhatsApp y validá

Seguí [DEPLOY.md, pasos 3 y 4](DEPLOY.md) y [PRUEBAS.md](PRUEBAS.md). Cargá el
número del teléfono que va a hacer de cliente en **Conexión → Modo prueba**
antes de escanear el QR del negocio.

Conservá el modo prueba hasta verificar todo. Apagarlo permite que el bot
atienda a personas fuera de esa lista; hacelo cuando catálogo, prompt y equipo
estén listos. La comparación usa los últimos ocho dígitos del teléfono:
preferí cargar siempre código de país y número completo.

## Si te acompaña una IA

Pegá esto en tu herramienta, con el repo abierto:

```text
Leé README.md, docs/PRIMEROS_PASOS.md, docs/GUIA.md y docs/PROMPTS.md.
Quiero instalar mi copia y probarla antes de conectar un número real.
Mi negocio es: [describilo]. Mi nivel técnico es: [contalo].
Guiame un paso por vez y decime el resultado esperado de cada paso.
Priorizá configurar desde el panel. No copies claves en archivos versionados
ni uses conversaciones reales como ejemplos. Conservá el modo prueba hasta
que complete docs/PRUEBAS.md. No arranques servicios duplicados contra mi base.
```

Si algo falla, [OPERACION.md](OPERACION.md) tiene la tabla de diagnóstico.
Al pedir ayuda, indicá el paso, el error sin secretos, tu sistema operativo y
el commit del repo. No pegues tokens, claves, QR ni conversaciones de clientes.
