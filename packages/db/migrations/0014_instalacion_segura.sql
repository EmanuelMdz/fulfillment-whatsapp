-- El registro de migraciones tampoco es público: alterarlo saltearía cambios del esquema.
alter table public._migrations enable row level security;
revoke all on public._migrations from anon, authenticated;
grant all on public._migrations to service_role;

-- Las instalaciones nuevas empiezan en prueba. No cambia negocios ya instalados.
alter table public.app_config alter column test_mode set default true;
update public.app_config set test_mode = true where installed_at is null;

-- Auth vive en otra API. Una vez creado el usuario, TODO lo que completa
-- la instalación en Postgres se confirma junto o se revierte junto.
create or replace function public.finish_installation(
  owner_id uuid, settings jsonb, module_rows jsonb, catalog_rows jsonb
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare owner_email text;
begin
  perform pg_advisory_xact_lock(731025);
  if exists (select 1 from public.team_members where role = 'owner') then
    raise exception 'Esta instalación ya tiene dueño';
  end if;
  select lower(email) into owner_email from auth.users where id = owner_id;
  if owner_email is null then raise exception 'El usuario de Auth no existe'; end if;

  update public.app_config set
    pack = settings->>'pack', business_name = settings->>'business_name',
    timezone = settings->>'timezone', currency = settings->>'currency',
    labels = settings->'labels', order_stages = settings->'order_stages',
    escalation_reasons = settings->'escalation_reasons', test_mode = true,
    install_token = null, installed_at = now()
  where id = 1;
  if not found then raise exception 'Falta la fila de configuración'; end if;

  insert into public.modules (key, enabled)
    select key, enabled from jsonb_to_recordset(module_rows) as m(key text, enabled boolean)
    on conflict (key) do update set enabled = excluded.enabled;

  insert into public.catalog_items (name, kind, price, description, bot_info, sort, track_stock, stock_qty)
    select name, kind, price, description, bot_info, sort, coalesce(track_stock, false), coalesce(stock_qty, 0)
    from jsonb_to_recordset(catalog_rows) as c(
      name text, kind text, price int, description text, bot_info text,
      sort int, track_stock boolean, stock_qty int
    );
  insert into public.team_members (email, role) values (owner_email, 'owner');
end $$;
revoke all on function public.finish_installation(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finish_installation(uuid, jsonb, jsonb, jsonb) to service_role;
