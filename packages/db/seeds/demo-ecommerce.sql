-- Catálogo de ejemplo para el Pack Ecommerce.
-- Sirve para que el bot tenga de qué hablar el primer día, antes de que
-- el dueño cargue lo suyo. Se borra sin miedo.
--
-- La configuración del pack (diccionario, estados, motivos) NO se siembra
-- acá: la escribe el instalador leyendo packages/core. Una sola fuente.

insert into public.catalog_items (name, kind, price, description, bot_info, sort, track_stock, stock_qty)
values
  (
    'Auriculares inalámbricos', 'product', 1890,
    'Bluetooth 5.3, cancelación de ruido, estuche de carga.',
    'Duran 6 horas de música continua y 24 más con el estuche. Cargan por USB-C. Vienen en negro y en blanco. Tienen 6 meses de garantía. Si preguntan si sirven para llamadas: sí, tienen microfono con reducción de ruido.',
    1, true, 12
  ),
  (
    'Parlante portátil', 'product', 2490,
    'Resistente al agua, 12 horas de batería.',
    'Aguanta salpicaduras y lluvia, no sumergirlo. Se pueden vincular dos y quedan en estéreo. Entra en una mochila sin problema. Garantía de 6 meses.',
    2, true, 7
  ),
  (
    'Smartwatch', 'product', 3290,
    'Ritmo cardíaco, notificaciones, 7 días de batería.',
    'Funciona con Android y con iPhone. Mide pulso, pasos y sueño. No es sumergible: aguanta transpiración y lluvia. Correa intercambiable. Garantía de 6 meses.',
    3, true, 4
  ),
  (
    'Cargador rápido 30W', 'product', 890,
    'USB-C, carga un teléfono al 50% en media hora.',
    'Sirve para cualquier teléfono con USB-C. El cable va aparte. Si preguntan si le sirve a un iPhone nuevo: sí, del 15 en adelante usan USB-C.',
    4, true, 25
  )
on conflict do nothing;
