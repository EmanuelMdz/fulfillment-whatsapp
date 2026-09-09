/**
 * Núcleo compartido entre el servidor y el panel.
 *
 * Acá viven los VALORES POR DEFECTO que el instalador siembra en la base
 * la primera vez. Después de eso la fuente de verdad es la tabla
 * `app_config`, editable desde el panel. Cambiar algo acá no afecta a una
 * instalación que ya corrió el instalador — es a propósito.
 */

export { SEEDS } from './seeds.js'
export { MIGRATION_REGISTRY_SQL, migrationSql } from './migrations.js'

/**
 * Módulos que se pueden prender y apagar. El núcleo no está acá: siempre va.
 *
 * `available: false` marca los que todavía no tienen código: el panel los
 * muestra como "próximamente" y no deja prenderlos. Un interruptor que
 * no hace nada es peor que no tenerlo. Cada módulo pasa a `true` el día
 * que su código entra (Tanda 3 en docs/PORTEO.md). La bandera en la
 * tabla `modules` se siembra igual según el pack: cuando el código
 * llegue, el módulo ya va a estar prendido donde corresponde.
 */
export const MODULES = [
  { key: 'stock', label: 'Inventario', description: 'existencias y aviso de faltante', available: false },
  { key: 'payments', label: 'Cobros', description: 'link de pago', available: false },
  { key: 'vision', label: 'Imágenes', description: 'leer fotos y comprobantes', available: false },
  { key: 'audio', label: 'Audios', description: 'transcribir notas de voz', available: false },
  { key: 'shipping', label: 'Envíos', description: 'conector propio, por defecto no hace nada', available: false },
  { key: 'ads', label: 'Anuncios', description: 'de qué aviso vino el chat', available: false },
  { key: 'hours', label: 'Horarios', description: 'atención por franja', available: false },
  { key: 'team', label: 'Equipo', description: 'asignar casos a personas', available: false },
]

/** Lo que siempre está, en cualquier instalación. Se lista para el panel. */
export const CORE_FEATURES = [
  'Conexión del número por QR',
  'Conversaciones y toma de control humana',
  'Prompts editables',
  'Leads y ficha configurable',
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
  agent: {
    label: 'Agente', modules: [],
    labels: { contact: 'Lead', contact_plural: 'Leads' },
    stages: [], reasons: [],
  },
  // El punto de partida para cualquier negocio: palabras neutras, un
  // circuito de pedido simple, motivos de derivación que sirven en
  // cualquier rubro. Desde acá el dueño renombra lo que quiera en
  // Ajustes; los otros dos packs son atajos para dos rubros comunes.
  general: {
    label: 'General',
    modules: [],
    labels: {
      contact: 'Cliente',
      contact_plural: 'Clientes',
      item: 'Producto',
      item_plural: 'Catálogo',
      order: 'Pedido',
      order_plural: 'Pedidos',
      order_new: 'Nuevo pedido',
    },
    stages: [
      { key: 'nuevo', label: 'Nuevo', final: false },
      { key: 'en_proceso', label: 'En proceso', final: false },
      { key: 'completado', label: 'Completado', final: true },
      { key: 'cancelado', label: 'Cancelado', final: true },
    ],
    reasons: [
      { key: 'pedir_humano', label: 'Pide hablar con una persona' },
      { key: 'queja', label: 'Queja o reclamo' },
      { key: 'urgencia', label: 'Urgencia' },
      { key: 'sin_avance', label: 'La conversación no avanza' },
      { key: 'no_supo', label: 'La IA no supo responder' },
    ],
  },

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
