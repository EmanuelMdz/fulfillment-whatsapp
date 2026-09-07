export function parseEnv(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else value = value.replace(/\s+#.*$/, '').trim()
    values[match[1]] = value
  }
  return values
}

export function environmentProblems(env) {
  const problems = []
  if (!/^https:\/\/[a-z0-9]{10,}\.supabase\.co\/?$/.test(env.SUPABASE_URL ?? '')) {
    problems.push('SUPABASE_URL: copiá la Project URL completa (https://…supabase.co), no la URL del dashboard.')
  }
  const token = env.SUPABASE_ACCESS_TOKEN?.trim()
  const manual = Boolean(env.SUPABASE_ANON_KEY?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  if (!manual && !/^sbp_[a-zA-Z0-9_-]{20,}$/.test(token ?? '')) {
    problems.push('Falta un SUPABASE_ACCESS_TOKEN completo, o las dos claves del proyecto para el modo manual.')
  }
  if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT) < 1 || Number(env.PORT) > 65535)) {
    problems.push('PORT debe ser un entero entre 1 y 65535. En local podés usar 3000; en Railway quitá esta variable.')
  }
  return problems
}
