import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_MARKER, limpiar, sembrar } from '../scripts/demo.mjs'

function database({ failDelete = false } = {}) {
  const calls = []
  let nextId = 0
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call)
    const q = {
      select() { return q }, single() { return q },
      insert(rows) { call.rows = rows; return q },
      delete() { call.deleting = true; return q },
      eq(...args) { call.filters.push(['eq', ...args]); return q },
      like(...args) { call.filters.push(['like', ...args]); return q },
      in(...args) { call.filters.push(['in', ...args]); return q },
      then(resolve) { resolve({ data: call.rows ? { id: `test-${nextId++}` } : table === 'contacts' ? [{ id: 'demo-contact' }] : [],
        error: call.deleting && failDelete ? new Error('falló el borrado') : null }) },
    }
    return q
  } }
}

test('demo usa destinos que no son teléfonos, no deja tareas activas y borra solo datos marcados', async () => {
  const db = database()
  await sembrar(db)
  const contacts = db.calls.filter((c) => c.table === 'contacts' && c.rows)
  assert.equal(contacts.length, 5)
  assert.ok(!db.calls.some((c) => c.table === 'orders' && c.rows))
  assert.ok(contacts.every((c) => c.rows.phone.startsWith('demo:') && c.rows.collected._demo === DEMO_MARKER))
  assert.ok(db.calls.filter((c) => c.table === 'followups' && c.rows).every((c) => c.rows.status === 'cancelled'))
  assert.deepEqual(db.calls[0].filters, [['eq', 'collected->>_demo', DEMO_MARKER], ['like', 'phone', 'demo:%']])
  await assert.rejects(limpiar(database({ failDelete: true })), /falló el borrado/)
})
