#!/usr/bin/env node
/**
 * Datos de demostración: conversaciones, leads y métricas de mentira,
 * para ver el panel lleno antes de conectar un número.
 *
 *   npm run demo           carga cinco conversaciones de ejemplo
 *   npm run demo:limpiar   las borra todas
 *
 * Para qué sirve: mostrar el sistema en una clase o a un cliente sin
 * tener que inventar una charla en vivo, y entender cómo se ve cada
 * estado (el bot atendiendo, un chat derivado, un lead esperando
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
 * el bot solo, el bot que deriva, el link compartido, la persona que
 * tomó el control, y la conversación terminada.
 */
const CHARLAS = [
  {
    nombre: 'Lucía Ferrer', telefono: `${PREFIJO}11`, estado: 'bot', hace: 3 * HORA,
    mensajes: [
      ['customer', 'Hola, quiero conocer cómo trabajan. Soy Lucía.'],
      ['bot', 'Hola Lucía. ¿Qué te gustaría resolver?'],
      ['customer', 'Quiero ordenar las consultas que llegan a mi equipo.'],
      ['bot', 'Podés elegir un horario para conversar acá: https://example.invalid/agenda'],
    ],
    datos: { nombre_completo: 'Lucía Ferrer', interes: 'Organizar consultas', etapa: 'Link compartido' },
  },
  {
    nombre: 'Martín Silva', telefono: `${PREFIJO}22`, estado: 'humano', hace: 40 * MINUTO,
    mensajes: [
      ['customer', 'Prefiero hablar con alguien del equipo.'],
      ['bot', 'Te paso con el equipo para continuar por acá.'],
    ],
    revision: { reason: 'Solicita atención humana', detail: 'Prefiere conversar con una persona.' },
    datos: { etapa: 'En atención' },
  },
  {
    nombre: 'Sofía Rodríguez', telefono: `${PREFIJO}33`, estado: 'bot', hace: 12 * MINUTO,
    mensajes: [
      ['customer', '¿Me pasás información?'],
      ['bot', 'Claro. ¿Qué te gustaría conocer?'],
    ],
    datos: { etapa: 'Consulta abierta' },
    seguimiento: { mensaje: 'Retomo tu consulta: ¿qué información necesitás?', enHoras: 24 },
  },
  {
    nombre: 'Diego Pereira', telefono: `${PREFIJO}44`, estado: 'humano', hace: 26 * HORA,
    mensajes: [
      ['customer', 'Tengo algunas preguntas sobre mi caso.'],
      ['bot', 'Te paso con el equipo.'],
      ['human', 'Hola Diego, contame qué necesitás y lo vemos.'],
    ],
    revision: { reason: 'Consulta para el equipo', detail: 'Atendiendo su caso.', resuelto: true },
    datos: { etapa: 'En atención' },
  },
  {
    nombre: 'Valentina Costa', telefono: `${PREFIJO}55`, estado: 'cerrado', hace: 4 * DIA,
    mensajes: [
      ['customer', 'Gracias, encontré la información que necesitaba.'],
      ['bot', 'Gracias por escribirnos.'],
    ],
    datos: { nombre_completo: 'Valentina Costa', etapa: 'Consulta resuelta' },
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
