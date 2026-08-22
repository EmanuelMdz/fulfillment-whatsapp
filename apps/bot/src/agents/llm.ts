import { loadEnv } from '../config/env.js'

/**
 * Una sola función para hablar con el modelo, con dos proveedores detrás.
 *
 * Se elige con LLM_PROVIDER y LLM_MODEL. Los nombres de modelo cambian
 * seguido: si esto devuelve un 404, casi siempre es que el modelo del .env
 * ya no existe. Por eso el error incluye el nombre.
 */

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

export async function chat(system: string, turns: Turn[]): Promise<string> {
  const { llm } = loadEnv()
  return llm.provider === 'openai' ? openai(system, turns) : gemini(system, turns)
}

async function gemini(system: string, turns: Turn[]): Promise<string> {
  const { llm } = loadEnv()
  if (!llm.geminiKey) throw new Error('Falta GEMINI_API_KEY')

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

async function openai(system: string, turns: Turn[]): Promise<string> {
  const { llm } = loadEnv()
  if (!llm.openaiKey) throw new Error('Falta OPENAI_API_KEY')

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
