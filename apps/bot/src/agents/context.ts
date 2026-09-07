import { formatNowForPrompt } from '../utils/datetime.js'
import { getCatalog, getConfig, getPrompts, type AppConfig } from '../db/queries.js'

/**
 * Arma lo que el modelo va a leer antes de contestar.
 *
 * Un modelo recibe UN texto de sistema. El del negocio es un solo
 * documento en markdown que el dueño escribe desde Studio (quién es,
 * datos del negocio, reglas, cuándo deriva, cómo cierra). Abajo, el
 * código agrega lo mecánico que el dueño no tiene por qué escribir: la
 * fecha con día de semana, el catálogo con sus ids, los motivos de
 * derivación y el formato de la respuesta.
 *
 * El orden importa: primero quién es, después qué puede decir, y al final
 * lo que sabe. La ficha de cada cosa del catálogo (`bot_info`) es lo que
 * más mueve la aguja de la calidad de las respuestas — mucho más que el
 * prompt.
 *
 * El turno no devuelve texto suelto: devuelve una DECISIÓN en JSON —
 * qué contestar, si hace falta derivar a una persona, y qué datos nuevos
 * dio el cliente. Ver agents/decision.ts para el otro lado del contrato.
 */
export async function buildTurnContext(
  channel: string,
): Promise<{ system: string; config: AppConfig }> {
  const [prompts, catalog, config] = await Promise.all([
    getPrompts(channel),
    getCatalog(),
    getConfig(),
  ])

  const bloques: string[] = []

  if (config.business_name) bloques.push(`Trabajás en: ${config.business_name}.`)

  // El prompt del negocio, tal cual lo escribió el dueño.
  if (prompts.sistema?.trim()) bloques.push(prompts.sistema.trim())

  // La fecha con día de semana: sin él, el modelo promete cosas para días
  // en los que el negocio no atiende. Ver utils/datetime.ts.
  bloques.push(`Ahora es: ${formatNowForPrompt(config.timezone)} (hora local del negocio).`)

  if (catalog.length) {
    // El id va en la línea para que el modelo pueda armar un pedido
    // apuntando a cosas REALES del catálogo — nunca por nombre, que
    // escribe como quiere.
    const lineas = catalog.map((item) => {
      const partes = [`- ${item.name} [id: ${item.id}]`]
      if (item.price > 0) partes.push(`precio: ${item.price}`)
      if (item.description) partes.push(item.description)
      if (item.bot_info) partes.push(item.bot_info)
      return partes.join(' · ')
    })
    bloques.push(`## Lo que ofrece el negocio\n${lineas.join('\n')}`)
  } else {
    bloques.push(
      '## Lo que ofrece el negocio\nTodavía no hay nada cargado en el catálogo. Si te preguntan por precios o por lo que ofrece el negocio, decí que en un momento te confirman y no inventes nada.',
    )
  }

  // Los motivos de derivación son DATOS del negocio (editables desde el
  // panel), no código: una tienda deriva por "verificar pago", una clínica
  // por "quiere un turno". El modelo elige la clave; el código la valida.
  const motivos = config.escalation_reasons ?? []
  const listaMotivos = motivos.length
    ? motivos.map((m) => `  "${m.key}" → ${m.label}`).join('\n')
    : '  (no hay motivos configurados: usá null siempre)'

  bloques.push(
    [
      '## Formato de tu respuesta',
      'Respondé SIEMPRE con un JSON válido y nada más — sin texto antes ni después:',
      '{"mensajes": ["..."], "derivar": null, "datos": null, "pedido": null}',
      '',
      '- "mensajes": de 1 a 3 mensajes cortos, como burbujas de chat separadas.',
      '- "derivar": casi siempre null. Si la conversación necesita que siga una persona del negocio, poné UNA de estas claves (la clave exacta, no la descripción):',
      listaMotivos,
      '  Derivar no corta la conversación: tus mensajes se envían igual, y después sigue una persona.',
      '- "datos": solo si el cliente dio un dato personal nuevo en estos mensajes (por ejemplo nombre_completo, direccion, ciudad, telefono_alternativo), un objeto con esos pares. Si no dio nada nuevo, null.',
      '- "pedido": null casi siempre. SOLO cuando el cliente CONFIRMA que quiere avanzar con algo concreto (dijo que sí a un resumen claro), un objeto {"items": [{"id": "<id del catálogo>", "cantidad": 1}], "nota": "lo que haga falta aclarar"} usando los id EXACTOS del catálogo de arriba. En ese turno tus mensajes le dicen que quedó anotado y que el equipo se lo confirma por este mismo chat — con tu voz, sin prometer cuándo y sin decir "listo" ni "confirmado": el que confirma es el equipo, después.',
    ].join('\n'),
  )

  return { system: bloques.join('\n\n'), config }
}
