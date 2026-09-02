/**
 * Catálogo de ejemplo por pack. Sirve para que el bot tenga de qué hablar
 * el primer día, antes de que el dueño cargue lo suyo. Se borra sin
 * miedo desde el panel.
 *
 * Son filas de `catalog_items`, no SQL: el asistente de instalación las
 * inserta por la API de Supabase, que es lo único que el servidor tiene
 * (no hay conexión directa a Postgres).
 */
export const SEEDS = {
  ecommerce: [
    {
      name: 'Auriculares inalámbricos',
      kind: 'product',
      price: 1890,
      description: 'Bluetooth 5.3, cancelación de ruido, estuche de carga.',
      bot_info:
        'Duran 6 horas de música continua y 24 más con el estuche. Cargan por USB-C. Vienen en negro y en blanco. Tienen 6 meses de garantía. Si preguntan si sirven para llamadas: sí, tienen micrófono con reducción de ruido.',
      sort: 1,
      track_stock: true,
      stock_qty: 12,
    },
    {
      name: 'Parlante portátil',
      kind: 'product',
      price: 2490,
      description: 'Resistente al agua, 12 horas de batería.',
      bot_info:
        'Aguanta salpicaduras y lluvia, no sumergirlo. Se pueden vincular dos y quedan en estéreo. Entra en una mochila sin problema. Garantía de 6 meses.',
      sort: 2,
      track_stock: true,
      stock_qty: 7,
    },
    {
      name: 'Smartwatch',
      kind: 'product',
      price: 3290,
      description: 'Ritmo cardíaco, notificaciones, 7 días de batería.',
      bot_info:
        'Funciona con Android y con iPhone. Mide pulso, pasos y sueño. No es sumergible: aguanta transpiración y lluvia. Correa intercambiable. Garantía de 6 meses.',
      sort: 3,
      track_stock: true,
      stock_qty: 4,
    },
    {
      name: 'Cargador rápido 30W',
      kind: 'product',
      price: 890,
      description: 'USB-C, carga un teléfono al 50% en media hora.',
      bot_info:
        'Sirve para cualquier teléfono con USB-C. El cable va aparte. Si preguntan si le sirve a un iPhone nuevo: sí, del 15 en adelante usan USB-C.',
      sort: 4,
      track_stock: true,
      stock_qty: 25,
    },
  ],

  servicios: [
    {
      name: 'Consulta general',
      kind: 'service',
      price: 1200,
      description: 'Primera consulta, 30 minutos.',
      bot_info:
        'Dura media hora. Traer estudios previos si los tiene. Si es primera vez, pedirle nombre completo y documento. Cubierta por la mayoría de las mutualistas: si preguntan por la suya, derivar a recepción antes de confirmar.',
      sort: 1,
    },
    {
      name: 'Control',
      kind: 'service',
      price: 800,
      description: 'Seguimiento de un tratamiento en curso, 20 minutos.',
      bot_info: 'Solo para pacientes que ya vinieron. Dura 20 minutos. Si nunca vino, corresponde consulta general.',
      sort: 2,
    },
    {
      name: 'Estudio de laboratorio',
      kind: 'service',
      price: 1500,
      description: 'Análisis completo con resultados en 48 horas.',
      bot_info:
        'Hay que venir en ayunas de 8 horas. Los resultados salen en 48 horas hábiles y se mandan por correo. No hace falta turno previo, se atiende por orden de llegada de 7 a 10 de la mañana.',
      sort: 3,
    },
    {
      name: 'Consulta por videollamada',
      kind: 'service',
      price: 900,
      description: 'Misma consulta, a distancia, 30 minutos.',
      bot_info:
        'Se hace por videollamada. Se manda el link una hora antes. No sirve para casos que necesiten revisación física: en ese caso ofrecer consulta presencial.',
      sort: 4,
    },
  ],
}
