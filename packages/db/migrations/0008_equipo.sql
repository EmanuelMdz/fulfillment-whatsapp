-- ============================================================
-- 0008 — Quién es del equipo
--
-- Hasta acá, "estar logueado" alcanzaba para ver todo. Pero registrarse
-- en Supabase está abierto por defecto, y la clave pública viaja al
-- navegador: cualquiera podía crearse un usuario y entrar a leer las
-- conversaciones de un negocio ajeno. Ahora un usuario ve la base solo
-- si su email está en team_members, que se administra desde el panel
-- (Ajustes → Usuarios).
-- ============================================================

create table if not exists public.team_members (
  email      text primary key,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;

-- Quien ya tenía usuario sigue entrando: se importa desde Auth.
insert into public.team_members (email, role)
select lower(email), 'owner' from auth.users where email is not null
on conflict (email) do nothing;

-- security definer: corre como el dueño de la tabla y saltea RLS. Sin
-- eso, la policy de team_members llamaría a esta función, que leería
-- team_members, que aplicaría la policy… recursión infinita.
create or replace function public.is_team()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
     where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- La misma política "equipo" de siempre, pero ahora pregunta si el
-- usuario es del equipo en vez de aceptar a cualquier logueado.
do $$
declare t text;
begin
  foreach t in array array[
    'app_config', 'modules', 'contacts', 'catalog_items', 'orders',
    'conversations', 'messages', 'send_queue', 'prompts', 'notification_episodes',
    'event_log', 'review_queue', 'followups'
  ]
  loop
    execute format('drop policy if exists equipo on public.%I', t);
    execute format(
      'create policy equipo on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())',
      t
    );
  end loop;
end $$;

-- El equipo se ve a sí mismo. Altas y bajas van por el servidor.
drop policy if exists equipo on public.team_members;
create policy equipo on public.team_members
  for select to authenticated using (public.is_team());
