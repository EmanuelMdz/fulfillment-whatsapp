import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEnv, environmentProblems } from '../scripts/lib/environment.mjs'
import { isTestNumber, botPuedeResponder } from '../apps/bot/src/config/test-mode.ts'

test('el diagnóstico detecta placeholders, acepta modo manual y no revela secretos en sus errores', () => {
  assert.ok(environmentProblems({ SUPABASE_URL: 'https://TU_PROYECTO.supabase.co', SUPABASE_ACCESS_TOKEN: 'sbp_' }).length)
  assert.deepEqual(environmentProblems({ SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' }), [])
  const errors = environmentProblems({ SUPABASE_ACCESS_TOKEN: 'secreto-invalido', PORT: '65536' }).join(' ')
  assert.ok(!errors.includes('secreto-invalido'))
  assert.deepEqual(parseEnv('A="uno"\r\nB=dos # comentario\nexport C=\'tres\''), { A: 'uno', B: 'dos', C: 'tres' })
})

test('modo prueba: formatos locales, lista vacía, grupos y destinos demo', () => {
  assert.equal(isTestNumber('59899123456@c.us', ['099 123 456']), true)
  assert.equal(isTestNumber('59899123456@g.us', ['099 123 456']), false)
  assert.equal(isTestNumber('59899123456@lid', ['099 123 456']), false)
  assert.equal(botPuedeResponder({ test_mode: true, test_numbers: [] }, '59899123456@c.us'), false)
  assert.equal(botPuedeResponder({ test_mode: false }, 'demo:11'), false)
})
