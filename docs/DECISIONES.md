# Decisiones

## Alcance vigente · 8 de septiembre de 2026

El producto es un motor de WhatsApp con leads, conversaciones y seguimientos.
El prompt define objetivo, información, links, datos, etapas y cuándo derivar.
Se retiran catálogo, pedidos y packs del flujo inicial; su código y datos
históricos se conservan como referencia para extensiones. Esto reemplaza las
decisiones de producto anteriores sobre pedidos como núcleo y listas obligatorias.

El código conserva el contrato de acciones y los controles operativos. Los
seguimientos toman su cadencia del prompt; las horas inválidas se descartan.
La ficha se fusiona en SQL y el plan se agenda solo si el turno sigue vigente.
Los prompts de instalaciones existentes se conservan y deben revisarse en Studio.

## Registro histórico


Por qué el producto está armado así. Cada una tiene un costo que ya pagamos a
propósito; cambiarlas después sale caro, así que si alguna se revisa, que sea
sabiendo qué se rompe.

---

## 1. Un solo repo y un solo deploy

**Decisión.** Monorepo con dos aplicaciones, pero un único servicio: el servidor
Node sirve el panel ya compilado y expone la API y el webhook en el mismo origen.

**Por qué.** El sistema de origen son dos deploys, dos sets de variables, CORS y
una clave compartida que tiene que coincidir de los dos lados. Cada una de esas
cosas es un mensaje de soporte multiplicado por cada alumno. Un clone, un
archivo de configuración, una URL.

**Lo que cuesta.** El panel no sale por una red de distribución de contenido. A
esta escala no se nota.

---

## 2. El servidor tiene que estar siempre encendido

**Decisión.** Nada de funciones serverless.

**Por qué.** El bot espera entre 90 y 180 segundos antes de contestar para juntar
los mensajes sueltos, manda todo por una cola global uno por uno con pausas para
no comerse un bloqueo, corre seguimientos y vigila la sesión de WhatsApp. Nada de
eso sobrevive en un proceso que arranca y muere por pedido.

**Descartado en el camino.** Vercel: las funciones se despiertan por pedido y se
mueren, no hay dónde esperar ni dónde sostener la cola. Se podría reescribir todo
alrededor de un cron que corre cada minuto, pero eso agrega demora a cada
respuesta y retuerce la pieza más delicada del sistema para que entre donde no
entra.

**Elegido.** Railway: se conecta el repo de GitHub, detecta que es Node y queda
corriendo. Sin Docker, sin dominio que configurar. Render sirve igual, con la
salvedad de que su plan gratuito duerme el servicio y un servicio dormido no
manda seguimientos.

**Lo que cuesta.** Entre diez y quince dólares por mes por instalación (el
servidor más el puente de WhatsApp). Va dicho en la página de venta, no se
descubre en la clase cuatro.

**Consecuencia que no se puede olvidar.** Una sola réplica. La protección contra
el bloqueo del número depende de que exista una única cola de envío; dos
procesos mandando en paralelo la anulan por completo. Ver `DEPLOY.md`.

---

## 3. Un negocio, una base

**Decisión.** Sin `tenant_id`. Cada alumno tiene su Supabase y su deploy.

**Por qué.** Multi-negocio significa aislamiento por fila en cada consulta, y un
error deja a un negocio viendo los datos de otro. Además el alumno queda dueño de
su instalación: se la puede vender a un cliente y cobrarle por mes. Eso es el
argumento de venta del curso, no un detalle técnico.

**Lo que cuesta.** Una agencia con diez clientes tiene diez deploys. Es una
característica, no un defecto: se cobra por cada uno.

---

## 4. Módulos por bandera, nunca borrando código

**Decisión.** Todo lo opcional pasa por la tabla `modules`. Nada de "borrá la
carpeta que no uses".

**Por qué.** Un alumno que borra código rompe algo, no sabe qué y escribe a las
once de la noche. Y un fork por rubro significa arreglar cada error dos veces.

**Lo que cuesta.** Hay que sostener los puntos de corte en el pipeline y en el
menú. Se paga una vez.

---

## 5. Las tres listas son datos, no código

**Decisión.** El diccionario de palabras, los estados del pedido y los motivos de
derivación viven en `app_config`.

**Por qué.** Es lo que permite vender dos productos con un solo repo. Una clínica
no tiene ventas, tiene consultas; si el panel dice "Ventas", el dueño siente que
el sistema no es para él. Cambiar eso no puede requerir tocar código.

**Lo que cuesta.** No hay tipos estrictos sobre los estados. Se compensa con una
lista de valores permitidos en la configuración y validación al guardar.

---

## 6. Los pedidos no saben de envíos

**Decisión.** `orders` no tiene guía, ni transportista, ni dirección de entrega.
Eso es del módulo `shipping`.

**Por qué.** Un pedido sin envío le sirve igual a una tienda y a una clínica: es
la misma fila con otro nombre. En cuanto la tabla del núcleo sabe de logística,
el Pack Servicios arrastra columnas vacías y conceptos que no le corresponden.

---

## 7. El puente de WhatsApp es reemplazable

**Decisión.** El transporte está detrás de una interfaz. La API oficial de Meta
entra como segundo proveedor sin tocar el resto.

**Por qué.** El puente no oficial tiene riesgo real de bloqueo del número. Que un
alumno pueda cambiar de transporte sin rehacer el sistema es protección para él y
una clase entera para vos.

---

## 8. Instagram es un canal más, y es un módulo

**Decisión.** WhatsApp por el puente no oficial va en el núcleo. Instagram entra
como segundo proveedor, detrás de la misma interfaz, y **queda como módulo
opcional**.

**Por qué no va en el núcleo.** Conectar WhatsApp es escanear un código QR.
Conectar Instagram es crear una app en Meta, invitar al cliente como tester, que
él acepte, pasar por OAuth y sostener tokens que vencen — por cada cliente. Si
eso está en el camino obligatorio, la mayoría se traba ahí y abandona antes de
ver el bot contestar una sola vez.

**Lo que ya está resuelto.** La interfaz de proveedores existe desde el diseño
original, y los prompts se guardan por canal: el índice único de la
configuración es sobre sección más canal. Un tono distinto para Instagram que
para WhatsApp no necesita esquema nuevo.

**Lo que hay que verificar ANTES de construir.** El plan es una app de Meta por
cliente, sin App Review, con el cliente agregado como tester. La documentación se
contradice: el acceso estándar habla de servir cuentas agregadas en el panel de
la app, pero la regla de modos de app dice que en desarrollo solo se interactúa
con quien tiene un rol.

El test que lo resuelve: app creada, cuenta profesional como tester, webhook
conectado, y **un DM desde un teléfono sin ningún rol en esa app**. Si dispara y
la respuesta llega, el plan funciona. Si no, hay que ir por App Review y el
producto cambia. Menos de una hora, y es el paso más barato de todo el proyecto.

---

## 9. Todo se configura desde el panel; fuera de él, dos variables

**Decisión.** Las claves de IA, la dirección y la clave del puente de
WhatsApp, los tiempos del bot y la ventana nocturna viven en la base
(`app_config` y `app_secrets`) y se editan desde el panel. En el entorno
quedan solo `SUPABASE_URL` y `SUPABASE_ACCESS_TOKEN`, el token de acceso de
la cuenta de Supabase: con él el servidor busca las claves del proyecto,
crea las tablas y apaga los registros abiertos. La clave pública del panel
también la sirve el servidor en tiempo de ejecución (`/config.js`), así un
mismo build anda en cualquier instalación.

**Sobre el token.** Abre la cuenta entera de Supabase, no solo ese proyecto,
y se planteó guardarlo solo en memoria durante la instalación. Se decidió
que va en el entorno, a propósito: el alumno sabe qué es, y ese mismo token
es el que después le sirve a su Claude para seguir mejorando el sistema
contra su base. Quien no quiera darlo carga en su lugar las dos claves del
proyecto y pega el SQL a mano.

**Por qué.** El producto lo instala gente que recién empieza. Cada valor en un
archivo de texto o en la pantalla de variables del hosting es un lugar donde
equivocarse y un reinicio por cada cambio. El panel ya tiene login y ya era
el lugar de los prompts y las tres listas: era el lugar de todo.

**Lo que cuesta.** El servidor lee la configuración de la base con una caché
corta, y las claves necesitan una tabla sin política de lectura para el
navegador. Y una consecuencia de seguridad que había que resolver de paso: si
todo se edita desde el panel, quién entra al panel importa más — de ahí
`team_members` (0008) y el asistente de instalación con su código (0010).

---

## 10. La instalación es una pantalla, no un script

**Decisión.** Al arrancar contra una base recién creada, el servidor crea las
tablas solo (con el token de acceso) y el panel muestra un asistente:
elegir el pack, el nombre, crear el usuario. El script de terminal quedó
solo para preparar el `.env` local.

**Por qué.** El instalador anterior pedía la URI de Postgres con la
contraseña de la base, que nadie tiene a mano. Con el token de acceso el
servidor puede hacer todo, incluso crear tablas y cambiar la configuración
de Auth. Sin token, lo único que no puede es crear tablas, y para eso
alcanza con un paste en el editor SQL.

**Lo que cuesta.** Las rutas del asistente son públicas (no hay usuario
todavía) y se protegen con una prueba de que quien instala es el dueño: los
últimos caracteres del token que cargó en el hosting, o el código que viaja
dentro del SQL que pegó en su base.

---

## 11. Un sistema de diseño, no una hoja de estilos

**Decisión.** El panel usa Tailwind 4 con los tokens en un solo archivo
(`styles.css`, bloque `@theme`) y una docena de componentes propios en
`src/ui/` (`Card`, `Button`, `Badge`, `Field`, `Table`, `Kpi`…). Las
páginas combinan componentes; no escriben colores ni tamaños. Los
gráficos van con Recharts. La referencia visual: barra lateral oscura,
fondo gris claro, tarjetas blancas redondeadas, verde como único acento.

**Por qué.** El CSS anterior era una lista de clases por pantalla: cada
pantalla nueva agregaba las suyas y ninguna se parecía del todo a la
anterior. Con tokens y componentes, cambiar el look del producto entero es
tocar un archivo, y un alumno que agrega una pantalla la arma con las
mismas piezas y le sale igual a las demás.

**Lo que cuesta.** Tailwind y Recharts son dos dependencias más en el
panel, y el bundle del navegador es más grande (Recharts va en su propio
archivo, cacheado entre deploys). Y las tablas siguen teniendo que volverse
tarjetas en el teléfono: el componente `Table` lo hace solo.

---

## 12. Una copia nueva tiene que poder verificarse sin cuentas reales

**Decisión (7 de septiembre de 2026).** Node 24 y lockfile; `npm run check`
incluye tests con red bloqueada, Postgres en memoria y APIs simuladas. CI
repite esos controles en Windows y Linux. `npm run doctor` revisa el entorno
local sin imprimir credenciales ni tocar la base. No se agregan variables de
negocio al entorno.

Las migraciones comparten un generador entre servidor y terminal: ejecutarlas
y registrarlas es atómico, con bloqueo y omisión de las ya aplicadas. El
asistente confirma configuración, catálogo y dueño en un RPC restringido;
si Auth quedó creado antes de una caída, permite retomar con el mismo correo.
La recepción de un mensaje y su turno también se guardan en una transacción.

Las instalaciones nuevas empiezan en modo prueba. La demo usa destinos que
no son teléfonos, una marca explícita para borrar y cero seguimientos activos.
Administrar usuarios o aplicar migraciones desde el panel requiere ser dueño.

**Límite.** Estas pruebas no reemplazan conectar Supabase y WAHA reales ni
ejecutar PRUEBAS.md. Los pendientes de publicación están en LANZAMIENTO.md.
