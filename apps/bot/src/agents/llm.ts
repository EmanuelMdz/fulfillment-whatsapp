import { getSettings, type Settings } from '../config/settings.js'

/**
 * Una sola función para hablar con el modelo, con dos proveedores detrás.
 *
 * El proveedor, el modelo y la clave salen de la configuración del panel
 * (Studio → Modelo de IA). Los nombres de modelo cambian seguido: si esto
 * devuelve un 404, casi siempre es que el modelo que está en el panel ya
 * no existe. Por eso el error incluye el nombre.
 */

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

type Llm = Settings['llm']

export async function chat(system: string, turns: Turn[]): Promise<string> {
  const { llm } = await getSettings()
  // Un turno con texto vacío hace que Gemini rechace el pedido ENTERO
  // (400). Lo vacío ya viene traducido a "(mandó un archivo)" desde el
  // turno; esto es la última red.
  const limpios = turns.filter((t) => t.content.trim())
  return llm.provider === 'openai' ? openai(llm, system, limpios) : gemini(llm, system, limpios)
}

async function gemini(llm: Llm, system: string, turns: Turn[]): Promise<string> {
  if (!llm.geminiKey) throw new Error('Falta la clave de Gemini: cargala en el panel, pestaña Studio')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${llm.model}:generateContent?key=${llm.geminiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: t.content }],
      })),
      generationConfig: { temperature: 0.7 },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Gemini (${llm.model}) respondió ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const parts = data.candidates?.[0]?.content?.parts ?? []
  return parts.map((p) => p.text ?? '').join('').trim()
}

async function openai(llm: Llm, system: string, turns: Turn[]): Promise<string> {
  if (!llm.openaiKey) throw new Error('Falta la clave de OpenAI: cargala en el panel, pestaña Studio')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.openaiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: 0.7,
      messages: [{ role: 'system', content: system }, ...turns],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenAI (${llm.model}) respondió ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return (data.choices?.[0]?.message?.content ?? '').trim()
}
