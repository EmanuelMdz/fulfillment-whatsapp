# Decisiones

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

**Lo que cuesta.** Unos siete dólares por mes por instalación. Va dicho en la
página de venta, no se descubre en la clase cuatro.

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
