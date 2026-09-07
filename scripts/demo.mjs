#!/usr/bin/env node
/**
 * Datos de demostración: conversaciones, pedidos y métricas de mentira,
 * para ver el panel lleno antes de conectar un número.
 *
 *   npm run demo           carga cinco conversaciones de ejemplo
 *   npm run demo:limpiar   las borra todas
 *
 * Para qué sirve: mostrar el sistema en una clase o a un cliente sin
 * tener que inventar una charla en vivo, y entender cómo se ve cada
 * estado (el bot atendiendo, un chat derivado, un pedido esperando
 * confirmación, una conversación cerrada).
 *
 * Solo para una base de aprendizaje. Los destinos demo: no son teléfonos
 * y no se programan seguimientos. El borrado exige una marca explícita.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const DEMO_MARKER = 'fulfillment-demo-v2'
const PREFIJO = 'demo:'

function leerEnv() {
  const out = {}
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const clean = line.trim()
      if (!clean || clean.startsWith('#')) continue
      const eq = clean.indexOf('=')
      if (eq === -1) continue
      out[clean.slice(0, eq).trim()] = clean.slice(eq + 1).trim()
    }
  }
  for (const k of ['SUPABASE_URL', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (process.env[k]) out[k] = process.env[k]
  }
  return out
}

async function conectar() {
  const env = leerEnv()
  if (!env.SUPABASE_URL) throw new Error('Falta SUPABASE_URL en el .env')
  let service = env.SUPABASE_SERVICE_ROLE_KEY
  if (!service) {
    if (!env.SUPABASE_ACCESS_TOKEN) throw new Error('Falta SUPABASE_ACCESS_TOKEN (o SUPABASE_SERVICE_ROLE_KEY)')
    const ref = env.SUPABASE_URL.match(/^https?:\/\/([a-z0-9-]+)\./i)?.[1]
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
    })
    if (!res.ok) throw new Error(`Supabase respondió ${res.status} al pedir las claves`)
    service = (await res.json()).find((k) => k.name === 'service_role')?.api_key
  }
  return createClient(env.SUPABASE_URL, service, { auth: { persistSession: false, autoRefreshToken: false } })
}

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA
const hace = (ms) => new Date(Date.now() - ms).toISOString()

/**
 * Las cinco conversaciones. Cada una muestra un estado distinto del
 * sistema, que es lo que hace falta explicar en una clase:
 * el bot solo, el bot que deriva, el pedido anotado, la persona que
 * tomó el control, y la conversación terminada.
 */
const CHARLAS = [
  {
    nombre: 'Lucía Ferrer',
    telefono: `${PREFIJO}11`,
    estado: 'humano',
    hace: 3 * HORA,
    // El caso completo: consulta, elección, confirmación y pedido anotado.
    mensajes: [
      ['customer', 'Hola! vi la remera en instagram, tienen en negro?'],
      ['bot', 'Hola! Sí, la tenemos en negro 🙌'],
      ['bot', '¿Sabés qué talle usás? Si querés decime altura y peso y te ayudo a elegir.'],
      ['customer', 'mido 1.68 y peso 62'],
      ['bot', 'Con esa altura y peso te va perfecto el M.'],
      ['bot', 'Sale $990. ¿Te la mando a domicilio o pasás a buscarla?'],
      ['customer', 'a domicilio, vivo en pocitos'],
      ['bot', 'Dale! El envío en Montevideo sale $250 y llega en 24 a 48 horas hábiles.'],
      ['bot', 'Entonces sería: 1 remera negra talle M ($990) + envío ($250). ¿Te paso a anotarlo?'],
      ['customer', 'si dale'],
      ['bot', 'Listo, ya te lo anoté. El equipo lo confirma y te escribe por acá para coordinar 🙌'],
    ],
    revision: { reason: 'pedido_nuevo', detail: '1× Remera básica — $990\n1× Envío a domicilio — $250\nTotal: $1240' },
    pedido: {
      items: [
        { name: 'Remera básica', qty: 1, unit_price: 990 },
        { name: 'Envío a domicilio', qty: 1, unit_price: 250 },
      ],
      total: 1240,
      stage: 'nuevo',
      notes: 'Talle M, color negro. Envío a Pocitos.',
    },
    datos: { nombre_completo: 'Lucía Ferrer', direccion: 'Av. Brasil 2340 apto 701', ciudad: 'Montevideo' },
  },

  {
    nombre: 'Martín Silva',
    telefono: `${PREFIJO}22`,
    estado: 'humano',
    hace: 40 * MINUTO,
    // El bot deriva porque se lo piden: el caso más común de la bandeja.
    mensajes: [
      ['customer', 'buenas, necesito una factura a nombre de mi empresa'],
      ['bot', 'Hola! Para las facturas a nombre de una empresa te paso con el equipo, que lo maneja directo.'],
      ['bot', 'Ya te escriben por acá 🙌'],
      ['customer', 'perfecto gracias'],
    ],
    revision: { reason: 'pedir_humano', detail: 'buenas, necesito una factura a nombre de mi empresa' },
  },

  {
    nombre: 'Sofía Rodríguez',
    telefono: `${PREFIJO}33`,
    estado: 'bot',
    hace: 12 * MINUTO,
    // El bot solo, sin derivar: la conversación que no necesita a nadie.
    mensajes: [
      ['customer', 'hola! la gorra viene en beige?'],
      ['bot', 'Hola! Sí, la gorra viene en negro y en beige 🙌'],
      ['bot', 'Es talle único con regulador atrás, y el bordado es al frente (no es estampado, así que no se descascara). Sale $690.'],
      ['customer', 'buenisimo, la pienso y te aviso'],
      ['bot', 'Dale, sin problema! Cualquier cosa me escribís por acá.'],
    ],
    seguimiento: { mensaje: '¿Pudiste pensar lo de la gorra beige? Quedan pocas de ese color 🙌', enHoras: 3 },
  },

  {
    nombre: 'Diego Pereira',
    telefono: `${PREFIJO}44`,
    estado: 'humano',
    hace: 26 * HORA,
    // Una queja, y una persona que ya entró a atenderla: así se ve un
    // chat donde el bot se calló solo.
    mensajes: [
      ['customer', 'me llegó la gorra con una mancha'],
      ['bot', 'Uf, perdón por eso. Te paso con el equipo para que lo resuelvan ya.'],
      ['human', 'Hola Diego, soy Cami del local. Perdón por lo de la gorra.'],
      ['human', 'Te la cambiamos sin cargo, ¿te queda cómodo que pasemos a buscarla mañana?'],
      ['customer', 'si dale, mañana a la tarde estoy'],
    ],
    revision: { reason: 'queja', detail: 'me llegó la gorra con una mancha', resuelto: true },
  },

  {
    nombre: 'Valentina Costa',
    telefono: `${PREFIJO}55`,
    estado: 'cerrado',
    hace: 4 * DIA,
    // Terminada: el pedido se entregó y el chat se cerró.
    mensajes: [
      ['customer', 'hola, quiero 2 remeras blancas talle S'],
      ['bot', 'Hola! Perfecto. 2 remeras blancas talle S son $1980.'],
      ['bot', '¿Retirás en el local o te las mando?'],
      ['customer', 'paso yo por el local'],
      ['bot', 'Listo, ya te lo anoté. El equipo lo confirma y te escribe por acá 🙌'],
      ['human', 'Hola Valentina! Confirmado, te esperamos. Estamos hasta las 19.'],
      ['customer', 'genial, gracias!'],
    ],
    pedido: {
      items: [{ name: 'Remera básica', qty: 2, unit_price: 990 }],
      total: 1980,
      stage: 'completado',
      notes: 'Talle S, blancas. Retira en el local.',
      hace: 4 * DIA,
    },
    datos: { nombre_completo: 'Valentina Costa' },
  },
]

/** Los eventos que hacen que Métricas tenga una curva creíble. */
function eventosDeLaSemana() {
  const eventos = []
  // Más actividad los últimos días que al principio: la curva sube.
  const porDia = [4, 6, 5, 9, 8, 12, 11]
  porDia.forEach((cantidad, i) => {
    const dia = (6 - i) * DIA
    for (let n = 0; n < cantidad; n++) {
      eventos.push({ event_type: 'turn.answered', severity: 'info', payload: {}, created_at: hace(dia - n * 40 * MINUTO) })
    }
    // Una derivación cada tres respuestas, más o menos.
    for (let n = 0; n < Math.round(cantidad / 3); n++) {
      eventos.push({ event_type: 'review.queued', severity: 'info', payload: {}, created_at: hace(dia - n * 3 * HORA) })
    }
    if (i % 2 === 0) {
      eventos.push({ event_type: 'followup.sent', severity: 'info', payload: {}, created_at: hace(dia - 5 * HORA) })
    }
  })
  return eventos
}

export async function limpiar(db) {
  const { data: contactos, error } = await db.from('contacts').select('id')
    .eq('collected->>_demo', DEMO_MARKER).like('phone', `${PREFIJO}%`)
  if (error) throw error
  const ids = (contactos ?? []).map((c) => c.id)
  if (ids.length) {
    // Las conversaciones y sus mensajes se van en cascada; los pedidos
    // apuntan al contacto con `on delete set null`, así que van a mano.
    for (const [tabla, campo] of [['orders', 'contact_id'], ['conversations', 'contact_id'], ['contacts', 'id']]) {
      const result = await db.from(tabla).delete().in(campo, ids)
      if (result.error) throw result.error
    }
  }
  // Los eventos de demostración se reconocen por la marca.
  const events = await db.from('event_log').delete().eq('payload->>demo', DEMO_MARKER)
  if (events.error) throw events.error
  return ids.length
}

export async function sembrar(db) {
  await limpiar(db)

  for (const charla of CHARLAS) {
    // ── Contacto ──
    const { data: contacto, error: e1 } = await db
      .from('contacts')
      .insert({ name: charla.nombre, phone: charla.telefono, collected: { ...charla.datos, _demo: DEMO_MARKER } })
      .select('id')
      .single()
    if (e1) throw new Error(`contacto ${charla.nombre}: ${e1.message}`)

    // ── Conversación ──
    const chatId = charla.telefono
    const { data: conv, error: e2 } = await db
      .from('conversations')
      .insert({
        contact_id: contacto.id,
        channel: 'whatsapp',
        chat_id: chatId,
        state: charla.estado,
        human_at: charla.estado === 'humano' ? hace(charla.hace) : null,
        created_at: hace(charla.hace + charla.mensajes.length * 2 * MINUTO),
      })
      .select('id')
      .single()
    if (e2) throw new Error(`conversación ${charla.nombre}: ${e2.message}`)

    // ── Mensajes, uno cada dos minutos hacia adelante ──
    const total = charla.mensajes.length
    const filas = charla.mensajes.map(([autor, cuerpo], i) => ({
      conversation_id: conv.id,
      external_id: `demo-${charla.telefono}-${i}`,
      direction: autor === 'customer' ? 'in' : 'out',
      author: autor,
      body: cuerpo,
      created_at: hace(charla.hace + (total - i) * 2 * MINUTO),
    }))
    const { error: e3 } = await db.from('messages').insert(filas)
    if (e3) throw new Error(`mensajes ${charla.nombre}: ${e3.message}`)

    // ── Caso de revisión ──
    if (charla.revision) {
      const { error } = await db.from('review_queue').insert({
        conversation_id: conv.id,
        reason: charla.revision.reason,
        detail: charla.revision.detail,
        status: charla.revision.resuelto ? 'resolved' : 'open',
        resolved_at: charla.revision.resuelto ? hace(charla.hace - HORA) : null,
        created_at: hace(charla.hace),
      })
      if (error) throw new Error(`revisión ${charla.nombre}: ${error.message}`)
    }

    // ── Pedido ──
    if (charla.pedido) {
      const { error } = await db.from('orders').insert({
        contact_id: contacto.id,
        items: charla.pedido.items,
        total: charla.pedido.total,
        stage: charla.pedido.stage,
        source: 'bot',
        notes: charla.pedido.notes,
        created_at: hace(charla.pedido.hace ?? charla.hace),
      })
      if (error) throw new Error(`pedido ${charla.nombre}: ${error.message}`)
    }

    // ── Seguimiento programado ──
    if (charla.seguimiento) {
      const { error } = await db.from('followups').insert({
        conversation_id: conv.id,
        message: charla.seguimiento.mensaje,
        scheduled_at: new Date(Date.now() + charla.seguimiento.enHoras * HORA).toISOString(),
        status: 'cancelled',
      })
      if (error) throw new Error(`seguimiento ${charla.nombre}: ${error.message}`)
    }
  }

  // ── Eventos, para que Métricas tenga curva ──
  const eventos = eventosDeLaSemana().map((e) => ({ ...e, payload: { ...e.payload, demo: DEMO_MARKER } }))
  const { error } = await db.from('event_log').insert(eventos)
  if (error) throw new Error(`eventos: ${error.message}`)

  return { charlas: CHARLAS.length, eventos: eventos.length }
}

async function main() {
  const db = await conectar()
  if (process.argv[2] === 'limpiar') {
    const borrados = await limpiar(db)
    console.log(`\n  Listo: ${borrados} conversación(es) de demostración borradas.\n`)
    return
  }
  const r = await sembrar(db)
  console.log(`\n  Listo: ${r.charlas} conversaciones y ${r.eventos} eventos de demostración.`)
  console.log('  Mirá el panel: Conversaciones, Revisión, Pedidos y Métricas.')
  console.log('  Para borrarlos: npm run demo:limpiar\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch((err) => {
  console.error(`\n  ${err.message}\n`)
  process.exit(1)
})
