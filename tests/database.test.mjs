import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { MIGRATION_REGISTRY_SQL, migrationSql, PACKS, SEEDS } from '../packages/core/src/index.js'

test('instalación desde cero, rollback, repetición del SQL y permisos', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  // Emula los roles y el contrato auth.jwt de Supabase. No usa su API ni
  // datos de una cuenta real. gen_random_uuid ya viene en Postgres.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `)
  const dir = new URL('../packages/db/migrations/', import.meta.url)
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  const bundle = MIGRATION_REGISTRY_SQL + files.map((name) => migrationSql(name,
    readFileSync(new URL(name, dir), 'utf8').replace('create extension if not exists pgcrypto;', ''),
  )).join('\n')
  await db.exec(bundle)
  assert.equal((await db.query('select count(*)::int as n from public._migrations')).rows[0].n, files.length)
  assert.equal((await db.query('select test_mode from public.app_config')).rows[0].test_mode, true)

  const ownerId = '00000000-0000-4000-8000-000000000001'
  await db.query('insert into auth.users values ($1, $2)', [ownerId, 'owner@example.invalid'])
  const settings = { pack: 'general', business_name: 'Demo', timezone: 'UTC', currency: '$',
    labels: PACKS.general.labels, order_stages: PACKS.general.stages, escalation_reasons: PACKS.general.reasons }
  const finish = (catalog) => db.query('select public.finish_installation($1, $2, $3, $4)',
    [ownerId, settings, [{ key: 'stock', enabled: false }], catalog])

  await assert.rejects(finish([{ ...SEEDS.general[0], kind: 'invalid' }]))
  assert.equal((await db.query('select installed_at from app_config')).rows[0].installed_at, null)
  assert.equal((await db.query('select count(*)::int as n from team_members')).rows[0].n, 0)
  await finish(SEEDS.general)
  assert.equal((await db.query('select count(*)::int as n from catalog_items')).rows[0].n, SEEDS.general.length)
  await assert.rejects(finish(SEEDS.general), /ya tiene dueño/)

  // Repegar el SQL no vuelve a importar usuarios ajenos ni pisa el prompt.
  await db.exec("insert into auth.users values (gen_random_uuid(), 'outsider@example.invalid'); update app_config set test_mode = false;")
  await db.exec(bundle)
  assert.equal((await db.query('select count(*)::int as n from team_members')).rows[0].n, 1)
  assert.equal((await db.query('select test_mode from app_config')).rows[0].test_mode, false)
  assert.equal((await db.query('select count(*)::int as n from catalog_items')).rows[0].n, SEEDS.general.length)

  // Si una migración falla, ni sus datos ni su registro quedan a medias.
  await assert.rejects(db.exec(migrationSql('9999_falla.sql', "update app_config set business_name = 'roto'; select 1/0;")))
  assert.equal((await db.query('select business_name from app_config')).rows[0].business_name, 'Demo')

  const conversationId = (await db.query("insert into conversations (chat_id) values ('test-chat') returning id")).rows[0].id
  const receive = (id, allowed = true) => db.query('select receive_customer_message($1,$2,$3,$4,$5,$6,$7,$8) as inserted',
    [conversationId, id, 'hola', null, null, new Date().toISOString(), allowed, 90])
  // Provoca un fallo DESPUÉS del INSERT del mensaje. El reintento debe
  // poder recibirlo, en lugar de confundirlo con un duplicado sin turno.
  await db.exec(`create function test_fail_update() returns trigger language plpgsql as $$ begin raise exception 'fallo al agendar'; end $$;
    create trigger test_fail before update on conversations for each row execute function test_fail_update();`)
  await assert.rejects(receive('external-1'), /fallo al agendar/)
  assert.equal((await db.query('select count(*)::int as n from messages')).rows[0].n, 0)
  await db.exec('drop trigger test_fail on conversations; drop function test_fail_update();')
  assert.equal((await receive('external-1')).rows[0].inserted, true)
  const due = (await db.query('select respond_after from conversations where id=$1', [conversationId])).rows[0].respond_after
  assert.ok(due)
  assert.equal((await receive('external-1')).rows[0].inserted, false)
  assert.equal((await db.query('select count(*)::int as n from messages')).rows[0].n, 1)
  await receive('external-2', false)
  assert.equal((await db.query('select respond_after from conversations where id=$1', [conversationId])).rows[0].respond_after, null)

  await db.exec('grant select on all tables in schema public to authenticated; set role authenticated;')
  assert.equal((await db.query('select * from contacts')).rows.length, 0)
  assert.equal((await db.query('select * from app_secrets')).rows.length, 0)
  await assert.rejects(db.exec("insert into _migrations (name) values ('fake.sql')"), /permission denied/)
  await assert.rejects(finish([]), /permission denied/)
  await db.exec("select set_config('request.jwt.claims', '{\"email\":\"owner@example.invalid\"}', false)")
  assert.equal((await db.query('select * from catalog_items')).rows.length, SEEDS.general.length)
})
