import { useEffect, useState } from 'react'
import { MODULES, PACKS } from '@fw/core'

/**
 * Pantalla puente hasta la tanda 2. Sirve para una sola cosa: confirmar que
 * el panel compilado y el servidor son el mismo origen y se hablan.
 */
export default function App() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError('No hay respuesta del servidor. ¿Está corriendo npm run dev?'))
  }, [])

  return (
    <main style={S.main}>
      <p style={S.eyebrow}>Fulfillment WhatsApp</p>
      <h1 style={S.h1}>Panel</h1>

      <section style={S.card}>
        <h2 style={S.h2}>Servidor</h2>
        {error && <p style={S.error}>{error}</p>}
        {!error && !health && <p style={S.muted}>Consultando…</p>}
        {health && (
          <dl style={S.dl}>
            <dt style={S.dt}>Estado</dt>
            <dd style={S.dd}>en línea</dd>
            <dt style={S.dt}>Zona horaria</dt>
            <dd style={S.dd}>{health.timezone}</dd>
            <dt style={S.dt}>WhatsApp</dt>
            <dd style={S.dd}>{health.whatsapp}</dd>
          </dl>
        )}
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Packs</h2>
        <ul style={S.list}>
          {Object.entries(PACKS).map(([key, pack]) => (
            <li key={key} style={S.li}>
              <b>{pack.label}</b>
              <span style={S.muted}> — {pack.modules.join(', ') || 'solo el núcleo'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>Módulos disponibles</h2>
        <ul style={S.list}>
          {MODULES.map((m) => (
            <li key={m.key} style={S.li}>
              <b>{m.label}</b>
              <span style={S.muted}> — {m.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

const S = {
  main: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '48px 24px 96px',
    fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
    color: '#131E18',
    lineHeight: 1.55,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: '#8A9A92',
  },
  h1: { margin: '8px 0 32px', fontSize: 34, letterSpacing: '-.02em' },
  h2: { margin: '0 0 12px', fontSize: 15, letterSpacing: '-.01em' },
  card: {
    border: '1px solid #DBE3DE',
    borderRadius: 10,
    padding: '18px 20px',
    marginBottom: 14,
    background: '#fff',
  },
  dl: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 },
  dt: { color: '#5B6B63', fontSize: 14 },
  dd: { margin: 0, fontSize: 14 },
  list: { margin: 0, paddingLeft: 18, fontSize: 14 },
  li: { marginBottom: 4 },
  muted: { color: '#5B6B63' },
  error: { color: '#8A3F36', fontSize: 14, margin: 0 },
}
