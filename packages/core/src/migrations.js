/** El mismo SQL para la terminal y el servidor: aplicar y registrar es una sola transacción. */
export const MIGRATION_REGISTRY_SQL = `
create table if not exists public._migrations (
  name text primary key, applied_at timestamptz not null default now()
);
alter table public._migrations enable row level security;
revoke all on public._migrations from anon, authenticated;
grant all on public._migrations to service_role;
`

export function migrationSql(name, source) {
  if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(name)) throw new Error(`Nombre de migración inválido: ${name}`)
  // Una migración puede contener sus propios DO $$ y funciones SQL.
  let delimiter = '$fw_source$'
  while (source.includes(delimiter)) delimiter = delimiter.replace('$', '$_')
  return `do $fw_migration$
begin
  perform pg_advisory_xact_lock(731024);
  if not exists (select 1 from public._migrations where name = '${name}') then
    execute ${delimiter}${source}${delimiter};
    insert into public._migrations (name) values ('${name}');
  end if;
end $fw_migration$;`
}
