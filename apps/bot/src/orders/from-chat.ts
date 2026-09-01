import { logEvent } from '../observability/events.js'
import {
  createBotOrder,
  findOpenBotOrder,
  getCatalog,
  type AppConfig,
  type BotOrderItem,
  type Conversation,
} from '../db/queries.js'

/**
 * El pedido que la IA armó en el chat.
 *
 * Regla madre, aprendida en producción: EL BOT NO CIERRA VENTAS SOLO.
 * Acá el pedido nace como una fila en la primera etapa del negocio y el
 * chat pasa al equipo — una persona lo mira, lo confirma y recién ahí el
 * cliente recibe el "listo". Un modelo que confirma solo termina
 * confirmando pedidos que no existen, con direcciones a medias, dos
 * veces.
 *
 * Segunda regla, igual de ganada a los golpes: los PRECIOS salen del
 * catálogo, nunca de lo que el modelo dijo en el chat. El modelo negocia
 * lo que no debe; la base no.
 */

export interface OrderFromChatResult {
  ok: boolean
  orderId?: string
  /** Resumen legible: para la cola de revisión y el aviso al grupo. */
  summary: string
  /** Si ok=false, qué pasó — para que la persona sepa qué mirar. */
  problem?: string
}

export async function createOrderFromChat(
  conversacion: Conversation,
  order: { items: Array<{ id: string; qty: number }>; note: string },
  config: AppConfig,
): Promise<OrderFromChatResult> {
  const stages = config.order_stages ?? []
  const finalStages = stages.filter((s) => s.final).map((s) => s.key)
  const stageInicial = stages[0]?.key ?? 'nuevo'

  // ¿Ya hay un pedido del bot sin terminar para este contacto? Un "sí,
  // dale" repetido diez mensajes después no puede armar el mismo pedido
  // dos veces: se manda a revisión y una persona decide.
  if (conversacion.contact_id) {
    const abierto = await findOpenBotOrder(conversacion.contact_id, finalStages)
    if (abierto) {
      return {
        ok: false,
        summary: '',
        problem: `Este contacto ya tiene un pedido sin terminar (etapa "${abierto.stage}"). Revisá el chat: puede ser una repetición o puede querer agregar algo.`,
      }
    }
  }

  // Validar contra el catálogo. Un id que no existe no se inventa ni se
  // adivina por nombre: el pedido no se crea y lo arma una persona
  // leyendo el chat. Crear un pedido con items fantasma es peor que no
  // crearlo.
  const catalog = await getCatalog()
  const items: BotOrderItem[] = []
  for (const it of order.items) {
    const encontrado = catalog.find((c) => c.id === it.id)
    if (!encontrado) {
      logEvent({
        eventType: 'order.failed',
        severity: 'warn',
        conversationId: conversacion.id,
        payload: { motivo: 'id_fuera_del_catalogo', id: it.id },
      })
      return {
        ok: false,
        summary: '',
        problem: 'La IA confirmó un pedido pero apuntó a algo que no está en el catálogo. Crealo a mano leyendo el chat.',
      }
    }
    items.push({
      catalog_item_id: encontrado.id,
      name: encontrado.name,
      qty: it.qty,
      unit_price: encontrado.price,
    })
  }

  const total = items.reduce((suma, i) => suma + i.qty * i.unit_price, 0)
  const orderId = await createBotOrder({
    contactId: conversacion.contact_id,
    items,
    total,
    stage: stageInicial,
    notes: order.note,
  })

  const lineas = items.map((i) => `${i.qty}× ${i.name} — $${i.qty * i.unit_price}`)
  const summary = [...lineas, `Total: $${total}`, order.note ? `Nota: ${order.note}` : '']
    .filter(Boolean)
    .join('\n')

  logEvent({
    eventType: 'order.created',
    conversationId: conversacion.id,
    payload: { order_id: orderId, total, items: items.length, stage: stageInicial },
  })

  return { ok: true, orderId, summary }
}
