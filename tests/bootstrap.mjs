// Los tests nunca heredan credenciales reales del .env ni llaman a servicios.
process.env.SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co'
process.env.SUPABASE_ACCESS_TOKEN = 'sbp_' + 'x'.repeat(24) + 'abcdefgh'
process.env.SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
globalThis.fetch = async () => { throw new Error('Red bloqueada en tests: falta simular esta petición') }
