import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { initEnv } from '../apps/bot/src/config/env.ts'
import { DEFAULT_CONFIG } from '../apps/bot/src/db/queries.ts'
import { forgetSettings } from '../apps/bot/src/config/settings.ts'
import { buildTurnContext } from '../apps/bot/src/agents/context.ts'
import { parseTurnDecision } from '../apps/bot/src/agents/decision.ts'
import { decideFollowups } from '../apps/bot/src/agents/followup.ts'
import { responder } from '../apps/bot/src/workers/turns.ts'

await initEnv()
afterEach(() => { mock.restoreAll(); forgetSettings() })
const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const config = { ...DEFAULT_CONFIG, test_mode: false, quiet_hours_start: 0, quiet_hours_end: 0 }
const conv = { id: 'conversation', contact_id: 'lead', chat_id: '59899123456@c.us', channel: 'whatsapp', state: 'bot', last_inbound_id: 'inbound' }

function simulate({ prompt = 'Objetivo: compartir https://example.invalid/agenda. Seguimientos: uno a las 72 horas.', decision, plans = [], empty = false } = {}) {
  const calls = []
  mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const call = { path: url.pathname, query: url.searchParams, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null }
    calls.push(call)
    if (url.hostname === 'generativelanguage.googleapis.com') {
      const system = call.body.systemInstruction.parts[0].text
      const answer = system.includes('## Tu tarea AHORA') ? { seguimientos: plans } : decision
      return json({ candidates: [{ content: { parts: [{ text: empty ? '' : JSON.stringify(answer) }] } }] })
    }
    if (call.path === '/rest/v1/app_config') return json(config)
    if (call.path === '/rest/v1/app_secrets') return json([{ key: 'gemini_api_key', value: 'test-key' }])
    if (call.path === '/rest/v1/prompts') return json([{ section: 'sistema', channel: null, content: prompt }])
    if (call.path === '/rest/v1/contacts') return json({ name: 'Ana', collected: { interes: 'Diseño', etapa: 'Consulta' } })
    if (call.path === '/rest/v1/messages') return json(call.query.get('select') === 'id' ? { id: 'inbound' } :
      call.query.get('select') === 'body' ? { body: 'Me interesa, soy Ana' } : [{ author: 'customer', body: 'Me interesa, soy Ana' }])
    if (call.path === '/rest/v1/conversations') return json(conv)
    if (call.path === '/rest/v1/followups') return json([])
    if (call.path.endsWith('/schedule_followup_if_current')) return json(true)
    if (['/rest/v1/rpc/merge_lead_data', '/rest/v1/send_queue', '/rest/v1/event_log', '/rest/v1/review_queue'].includes(call.path)) return json(null)
    throw new Error('Petición inesperada: ' + call.method + ' ' + call.path)
  })
  return calls
}

test('el contexto usa el prompt y la ficha sin exigir catálogo ni imponer un cierre', async () => {
  const prompt = 'Objetivo: responder preguntas frecuentes. No compartir links ni recopilar datos.'
  const calls = simulate({ prompt })
  const { system } = await buildTurnContext('whatsapp', 'lead')
  assert.ok(system.includes(prompt))
  assert.ok(system.includes('Diseño'))
  assert.ok(!system.includes('"pedido"'))
  assert.ok(!calls.some((c) => /catalog|orders/.test(c.path)))
})

test('una derivación nueva y campos libres funcionan; un pedido antiguo se ignora', () => {
  const decision = parseTurnDecision(JSON.stringify({
    mensajes: ['Mirá Https://example.invalid/agenda'], derivar: 'Consulta técnica especial',
    datos: { interes: 'Diseño', etapa: 'Link compartido', vacio: '', invalido: 10 },
    pedido: { items: [{ id: 'old-product', cantidad: 1 }] },
  }))
  assert.deepEqual(decision, {
    messages: ['Mirá https://example.invalid/agenda'], escalateReason: 'Consulta técnica especial',
    data: { interes: 'Diseño', etapa: 'Link compartido' },
  })
  assert.equal(parseTurnDecision('{"datos": {"nombre": "Ana"}}').messages.length, 0)
})

test('seguimientos acepta una cadencia mayor a 48 horas y más de dos mensajes; no inventa horarios inválidos', async () => {
  const calls = simulate({ plans: [
    { mensaje: 'Primero', en_horas: 72 }, null, { mensaje: 'Inválido', en_horas: 'mañana' },
    { mensaje: 'Segundo', en_horas: 120 }, { mensaje: 'Tercero', en_horas: 168 },
    { mensaje: 'Negativo', en_horas: -1 }, { mensaje: 'Fuera de fecha', en_horas: 1e30 },
  ] })
  const plans = await decideFollowups('whatsapp', [{ author: 'bot', body: 'Te comparto el link' }], config, [])
  assert.deepEqual(plans.map((p) => p.hours), [72, 120, 168])
  const request = calls.find((c) => c.path.includes(':generateContent'))
  assert.ok(request.body.systemInstruction.parts[0].text.includes('No inventes una cadencia'))
  await new Promise((resolve) => setImmediate(resolve))
})

test('el turno comparte un link y guarda el lead sin pedido ni derivación obligatoria; el seguimiento ve la última respuesta', async () => {
  const answer = 'Podés elegir un horario en https://example.invalid/agenda'
  const calls = simulate({ decision: { mensajes: [answer], datos: { etapa: 'Link compartido' }, derivar: null,
    pedido: { items: [{ id: 'old-product', cantidad: 1 }] } }, plans: [{ mensaje: '¿Te quedó alguna consulta?', en_horas: 72 }] })
  await responder(conv)
  assert.equal(calls.find((c) => c.path === '/rest/v1/send_queue').body.body, answer)
  assert.deepEqual(calls.find((c) => c.path.endsWith('/merge_lead_data')).body.new_data, { etapa: 'Link compartido' })
  assert.ok(!calls.some((c) => /catalog|orders|review_queue/.test(c.path)))
  assert.ok(!calls.some((c) => c.path === '/rest/v1/conversations' && c.method === 'PATCH'))
  const requests = calls.filter((c) => c.path.includes(':generateContent'))
  assert.equal(requests.length, 2)
  assert.ok(requests[1].body.contents[0].parts[0].text.includes(answer))
  assert.equal(calls.find((c) => c.path.endsWith('/schedule_followup_if_current')).body.inbound_id, 'inbound')
  await new Promise((resolve) => setImmediate(resolve))
})

test('una respuesta vacía deriva sin enviar una frase escrita en el código', async () => {
  const calls = simulate({ empty: true })
  await responder(conv)
  assert.ok(!calls.some((c) => c.path === '/rest/v1/send_queue'))
  assert.ok(calls.some((c) => c.path === '/rest/v1/review_queue'))
  assert.equal(calls.find((c) => c.path === '/rest/v1/conversations' && c.method === 'PATCH').body.state, 'humano')
  await new Promise((resolve) => setImmediate(resolve))
})
