/**
 * Núcleo compartido entre el servidor y el panel.
 *
 * Acá viven los VALORES POR DEFECTO que el instalador siembra en la base
 * la primera vez. Después de eso la fuente de verdad es la tabla
 * `app_config`, editable desde el panel. Cambiar algo acá no afecta a una
 * instalación que ya corrió el instalador — es a propósito.
 */

/** Módulos que se pueden prender y apagar. El núcleo no está acá: siempre va. */
export const MODULES = [
  { key: 'stock', label: 'Inventario', description: 'existencias y aviso de faltante' },
  { key: 'payments', label: 'Cobros', description: 'link de pago' },
  { key: 'vision', label: 'Imágenes', description: 'leer fotos y comprobantes' },
  { key: 'audio', label: 'Audios', description: 'transcribir notas de voz' },
  { key: 'shipping', label: 'Envíos', description: 'conector propio, por defecto no hace nada' },
  { key: 'ads', label: 'Anuncios', description: 'de qué aviso vino el chat' },
  { key: 'hours', label: 'Horarios', description: 'atención por franja' },
  { key: 'team', label: 'Equipo', description: 'asignar casos a personas' },
]

/** Lo que siempre está, en cualquier instalación. Se lista para el panel. */
export const CORE_FEATURES = [
  'Conexión del número por QR',
  'Conversaciones y toma de control humana',
  'Prompts editables',
  'Contactos',
  'Catálogo',
  'Pedidos',
  'Seguimientos automáticos',
  'Cola de revisión',
  'Avisos a un grupo',
  'Métricas',
]

/**
 * Las tres listas que hacen que el mismo sistema se sienta nativo en una
 * tienda y en una clínica: cómo se llama cada cosa, por qué estados pasa un
 * pedido, y por qué motivos la IA deriva a una persona.
 */
export const PACKS = {
  ecommerce: {
    label: 'Ecommerce',
    modules: ['stock', 'payments'],
    labels: {
      contact: 'Cliente',
      contact_plural: 'Clientes',
      item: 'Producto',
      item_plural: 'Productos',
      order: 'Venta',
      order_plural: 'Ventas',
      order_new: 'Nueva venta',
    },
    stages: [
      { key: 'nuevo', label: 'Nuevo', final: false },
      { key: 'pago', label: 'Pago', final: false },
      { key: 'entregado', label: 'Entregado', final: true },
      { key: 'cancelado', label: 'Cancelado', final: true },
    ],
    reasons: [
      { key: 'verificar_pago', label: 'Verificar pago' },
      { key: 'devolucion', label: 'Devolución' },
      { key: 'seguimiento', label: 'Seguimiento del pedido' },
      { key: 'queja', label: 'Queja' },
      { key: 'sin_avance', label: 'La conversación no avanza' },
      { key: 'no_supo', label: 'La IA no supo responder' },
    ],
  },

  servicios: {
    label: 'Servicios',
    modules: ['hours', 'team'],
    labels: {
      contact: 'Paciente',
      contact_plural: 'Pacientes',
      item: 'Prestación',
      item_plural: 'Prestaciones',
      order: 'Consulta',
      order_plural: 'Consultas',
      order_new: 'Nueva consulta',
    },
    stages: [
      { key: 'consulta', label: 'Consulta', final: false },
      { key: 'presupuesto', label: 'Presupuesto enviado', final: false },
      { key: 'agendado', label: 'Agendado', final: false },
      { key: 'atendido', label: 'Atendido', final: true },
      { key: 'no_vino', label: 'No vino', final: true },
    ],
    reasons: [
      { key: 'pedir_turno', label: 'Quiere un turno' },
      { key: 'cobertura', label: 'Pregunta por cobertura' },
      { key: 'urgencia', label: 'Urgencia' },
      { key: 'cancelar', label: 'Quiere cancelar' },
      { key: 'sin_avance', label: 'La conversación no avanza' },
      { key: 'no_supo', label: 'La IA no supo responder' },
    ],
  },
}

/** Nombre visible de una cosa, según el pack. Ante la duda, devuelve la clave. */
export function label(pack, key) {
  return PACKS[pack]?.labels?.[key] ?? key
}

/** Los módulos que prende el instalador para un pack. */
export function modulesForPack(pack) {
  return PACKS[pack]?.modules ?? []
}
