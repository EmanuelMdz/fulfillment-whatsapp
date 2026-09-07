# Plan

> Plan histórico de desarrollo. El alcance disponible está en README.md y
> los pendientes de la primera release en LANZAMIENTO.md. No hace falta
> acceder a documentos privados para instalar el producto.

---

## Qué es

Un sistema de atención y ventas por WhatsApp con IA que los alumnos de la
academia clonan, conectan a su número y usan en negocios propios o de clientes.
Se extrae de un sistema que ya vende en producción, pero es un producto nuevo:
más simple, sin el rubro del original, y armado para que otro lo instale.

## Se vende como dos productos, es un solo repo

**Fulfillment Ecommerce** y **Fulfillment Clínicas**, con dos páginas de venta y
dos precios. Por dentro es el mismo código: lo que cambia son tres listas
guardadas en la base — el diccionario de palabras, los estados del pedido y los
motivos por los que la IA deriva a una persona.

Forkear significaría arreglar cada error del código común dos veces y dejar sin
salida al alumno de clínica que mañana quiera vender productos.

## El núcleo, que siempre va

Conectar el número por QR · conversaciones con toma de control humana · prompts
editables · contactos · catálogo · pedidos · seguimientos automáticos · cola de
revisión · avisos a un grupo · métricas.

Los pedidos van en el núcleo **sin envíos**: una venta y una consulta agendada
son la misma fila con otro nombre.

## Lo opcional

`stock` · `payments` · `vision` · `audio` · `shipping` · `hours` · `team` ·
`ads`. Se prenden y se apagan desde el panel.

## Las tres tandas

| | Qué | Cuánto |
|---|---|---|
| 1 | Núcleo del bot | 2 semanas |
| 2 | Panel y conexión por QR | 2 semanas |
| 3 | Los dos packs | 3 semanas |

El detalle y el criterio de "listo" de cada una está en `PORTEO.md`.

## Lo que hay que construir de cero

Unos doce días en total: la conexión por QR, el instalador, el registro de
módulos, las tres listas editables, el horario de atención, la asignación de
casos y el catálogo conectable a un ecommerce externo. Es la diferencia entre un
sistema que anda y un producto que otro puede instalar.

## Lo que cuesta tenerlo prendido

Servidor siempre encendido en Railway más el puente de WhatsApp en el mismo
proyecto: entre diez y quince dólares por mes por instalación. Base de datos,
gratis para empezar. El puente (WAHA) es gratis desde su versión 2026.6.1,
imágenes y audios incluidos. Modelos de IA, centavos por conversación. Y un
número de WhatsApp dedicado, nunca el personal.

El paso a paso para ponerlo en línea está en `DEPLOY.md`.

## Decisiones abiertas

- **Nombre.** "Fulfillment" promete logística, que es justo lo que queda afuera.
  Alternativas sobre la mesa: Ciclo, Mostrador.
- ~~**Puente de WhatsApp.** Confirmar si la versión libre maneja imágenes y audios.~~
  Cerrada el 1 de setiembre de 2026: desde WAHA 2026.6.1 todo es gratis
  (sesiones ilimitadas, multimedia, almacenamiento). Ver `AUDITORIA.md`, punto 3.
- **Agenda.** Un pedido en estado "agendado" con fecha alcanza para arrancar una
  clínica. Una agenda de verdad —grilla por profesional, duración, choques,
  recordatorio— es un módulo entero y suma dos o tres semanas.
- **Alcance de la v1.** Si entran imágenes y audios o quedan para la segunda
  camada. Son lo que más impresiona en una demo y lo que más cuesta sostener.
