import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { initEnv } from '../apps/bot/src/config/env.ts'
import { DEFAULT_CONFIG } from '../apps/bot/src/db/queries.ts'
import { forgetSettings } from '../apps/bot/src/config/settings.ts'
import { WahaProvider } from '../apps/bot/src/providers/waha.ts'
import { installRoute } from '../apps/bot/src/routes/install.ts'
import { panelRoute } from '../apps/bot/src/routes/panel.ts'
import { webhookRoute } from '../apps/bot/src/routes/webhook.ts'
import { migrationFiles } from '../apps/bot/src/db/migrate.ts'
import { Hono } from 'hono'

await initEnv()
afterEach(() => { mock.restoreAll(); forgetSettings() })
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'x-supabase-api-version': '2024-01-01' } })
const config = { ...DEFAULT_CONFIG, whatsapp_api_url: 'https://waha.example.invalid', whatsapp_session: 'default' }
function simulate(handler) {
  const calls = []
  mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input)
    const call = { path: url.pathname, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null, init }
    calls.push(call)
    const custom = await handler(call)
    if (custom) return custom
    if (call.path === '/rest/v1/app_config') return json(config)
    if (call.path === '/rest/v1/app_secrets') return json([
      { key: 'whatsapp_api_key', value: 'test-waha' }, { key: 'whatsapp_webhook_secret', value: 'test-webhook' },
    ])
    if (call.path === '/rest/v1/_migrations') return json(migrationFiles().map((name) => ({ name })))
    throw new Error(`Petición inesperada: ${call.method} ${call.path}`)
  })
  return calls
}

test('WAHA actualiza el webhook y preserva opciones antes de reiniciar una sesión existente', async () => {
  const calls = simulate((c) => {
    if (c.path === '/api/sessions/default' && c.method === 'GET') return json({ status: 'WORKING', config: { metadata: { label: 'negocio' } } })
    if (c.path.startsWith('/api/')) return json({})
  })
  await new WahaProvider().startSession('https://bot.example.invalid/webhook/whatsapp')
  const put = calls.find((c) => c.method === 'PUT')
  assert.equal(put.body.config.metadata.label, 'negocio')
  assert.match(put.body.config.webhooks[0].url, /bot.example.invalid.*secret=test-webhook/)
  assert.equal(calls.at(-1).path, '/api/sessions/default/restart')
  assert.ok(calls.filter((c) => c.path.startsWith('/api/')).every((c) => c.init.signal))
})

test('WAHA crea solo cuando no existe; un 401 no dispara un reinicio', async () => {
  const calls = simulate((c) => c.path.startsWith('/api/') ? json({ error: 'invalid key' }, 401) : null)
  await assert.rejects(new WahaProvider().startSession('https://bot.example.invalid/webhook'), /401/)
  assert.equal(calls.filter((c) => c.path.startsWith('/api/')).length, 1)
})

test('WAHA crea una sesión nueva con webhook cuando recibe 404', async () => {
  const calls = simulate((c) => {
    if (c.path === '/api/sessions/default') return json({}, 404)
    if (c.path === '/api/sessions') return json({})
  })
  await new WahaProvider().startSession('https://bot.example.invalid/webhook')
  assert.equal(calls.at(-1).body.start, true)
})

test('un destino demo jamás llega al proveedor', async () => {
  const calls = simulate(() => null)
  await assert.rejects(new WahaProvider().sendText('demo:11', 'hola'), /demostración/)
  assert.equal(calls.length, 0)
})

const form = { tokenTail: 'abcdefgh', pack: 'general', businessName: 'Demo', ownerEmail: 'owner@example.invalid', ownerPassword: 'test-password', seedDemo: true }
const finish = (body) => installRoute.request('/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('instalador: validación antes de escribir y finalización con una única transacción', async () => {
  const calls = simulate((c) => {
    if (c.path === '/rest/v1/team_members') return json([])
    if (c.path === '/auth/v1/admin/users') return json({ id: '00000000-0000-4000-8000-000000000001', email: form.ownerEmail })
    if (c.path === '/rest/v1/rpc/finish_installation' || c.path.endsWith('/config/auth')) return json(null)
  })
  assert.equal((await finish(null)).status, 400)
  assert.equal((await finish({ ...form, tokenTail: 'incorrecto' })).status, 403)
  assert.equal((await finish({ ...form, pack: 'constructor' })).status, 400)
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0)
  assert.equal((await finish(form)).status, 200)
  const rpc = calls.find((c) => c.path.endsWith('finish_installation'))
  assert.ok(rpc.body.catalog_rows.length)
  assert.ok(rpc.body.module_rows.every((m) => !m.enabled))
})

test('instalador: un fallo del RPC conserva la identidad y permite retomar sin duplicar catálogo', async () => {
  let rpcAttempts = 0
  let creates = 0
  const calls = simulate((c) => {
    if (c.path === '/rest/v1/team_members') return json([])
    if (c.path === '/auth/v1/admin/users' && c.method === 'POST') {
      return ++creates === 1 ? json({ id: '00000000-0000-4000-8000-000000000001', email: form.ownerEmail }) : json({ code: 'email_exists', msg: 'exists' }, 422)
    }
    if (c.path === '/auth/v1/admin/users') return json({ users: [{ id: '00000000-0000-4000-8000-000000000001', email: form.ownerEmail }] })
    if (c.path === '/auth/v1/admin/users/00000000-0000-4000-8000-000000000001') return json({ id: '00000000-0000-4000-8000-000000000001', email: form.ownerEmail })
    if (c.path.endsWith('finish_installation')) return ++rpcAttempts === 1 ? json({ message: 'fallo simulado' }, 500) : json(null)
    if (c.path.endsWith('/config/auth')) return json(null)
  })
  assert.equal((await finish(form)).status, 502)
  const retried = await finish(form)
  assert.equal(retried.status, 200, await retried.text())
  assert.equal(calls.filter((c) => c.method === 'DELETE').length, 0)
})

test('un miembro no puede cambiar la contraseña del dueño', async () => {
  const calls = simulate((c) => c.path === '/rest/v1/team_members' ? json([{ email: 'member@example.invalid', role: 'member' }]) : null)
  const app = new Hono()
  app.use('*', async (c, next) => { c.set('userEmail', 'member@example.invalid'); await next() })
  app.route('/', panelRoute)
  const res = await app.request('/users/password', { method: 'POST', body: JSON.stringify({ id: 'owner', password: 'test-password' }) })
  assert.equal(res.status, 403)
  assert.equal(calls.filter((c) => c.path.startsWith('/auth/')).length, 0)
})

test('webhook exige secreto y comunica fallos de persistencia para que WAHA reintente', async () => {
  simulate((c) => {
    if (c.path === '/rest/v1/conversations') return json({ id: 'chat-id', state: 'bot', chat_id: '59899123456@c.us' })
    if (c.path.endsWith('/receive_customer_message')) return json({ message: 'fallo temporal' }, 500)
    if (c.path === '/rest/v1/event_log') return json(null)
  })
  const event = { event: 'message', payload: { id: 'message-id', from: '59899123456@c.us', body: 'hola' } }
  assert.equal((await webhookRoute.request('/', { method: 'POST', body: JSON.stringify(event) })).status, 401)
  assert.equal((await webhookRoute.request('/?secret=test-webhook', { method: 'POST', body: JSON.stringify(event) })).status, 503)
  await new Promise((resolve) => setImmediate(resolve))
})
