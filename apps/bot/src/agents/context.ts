import { getCatalog, getConfig, getPrompts } from '../db/queries.js'

/**
 * Arma lo que el modelo va a leer antes de contestar.
 *
 * El orden importa: primero quién es, después qué puede decir, y al final
 * lo que sabe. La ficha de cada cosa del catálogo (`bot_info`) es lo que más
 * mueve la aguja de la calidad de las respuestas — mucho más que el prompt.
 */
export async function buildSystemPrompt(channel: string): Promise<string> {
  const [prompts, catalog, config] = await Promise.all([
    getPrompts(channel),
    getCatalog(),
    getConfig(),
  ])

  const bloques: string[] = []

  if (config.business_name) bloques.push(`Trabajás en: ${config.business_name}.`)
  if (prompts.identidad) bloques.push(prompts.identidad)
  if (prompts.atencion) bloques.push(prompts.atencion)

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

  bloques.push(
    'Contestá con un mensaje corto, como se escribe por chat. Sin firmar, sin saludos largos y sin repetir lo que el cliente acaba de decir.',
  )

  return bloques.join('\n\n')
}
