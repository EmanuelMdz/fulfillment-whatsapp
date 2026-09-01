import { formatNowForPrompt } from '../utils/datetime.js'
import { getCatalog, getConfig, getPrompts, type AppConfig } from '../db/queries.js'

/**
 * Arma lo que el modelo va a leer antes de contestar.
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
  if (prompts.identidad) bloques.push(prompts.identidad)
  if (prompts.atencion) bloques.push(prompts.atencion)

  // La fecha con día de semana: sin él, el modelo promete cosas para días
  // en los que el negocio no atiende. Ver utils/datetime.ts.
  bloques.push(`Ahora es: ${formatNowForPrompt(config.timezone)} (hora local del negocio).`)

  if (catalog.length) {
    const lineas = catalog.map((item) => {
      const partes = [`- ${item.name}`]
      if (item.price > 0) partes.push(`precio: ${item.price}`)
      if (item.description) partes.push(item.description)
      if (item.bot_info) partes.push(item.bot_info)
      return partes.join(' · ')
    })
    bloques.push(`Esto es lo que ofrece el negocio:\n${lineas.join('\n')}`)
  } else {
    bloques.push(
      'Todavía no hay nada cargado en el catálogo. Si te preguntan por precios o por lo que ofrece el negocio, decí que en un momento te confirman y no inventes nada.',
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
      'Respondé SIEMPRE con un JSON válido y nada más — sin texto antes ni después:',
      '{"mensajes": ["..."], "derivar": null, "datos": null}',
      '',
      '- "mensajes": de 1 a 3 mensajes cortos, como burbujas de chat separadas.',
      '- "derivar": casi siempre null. Si la conversación necesita que siga una persona del negocio, poné UNA de estas claves (la clave exacta, no la descripción):',
      listaMotivos,
      '  Derivar no corta la conversación: tus mensajes se envían igual, y después sigue una persona.',
      '- "datos": solo si el cliente dio un dato personal nuevo en estos mensajes (por ejemplo nombre_completo, direccion, ciudad, telefono_alternativo), un objeto con esos pares. Si no dio nada nuevo, null.',
    ].join('\n'),
  )

  return { system: bloques.join('\n\n'), config }
}
