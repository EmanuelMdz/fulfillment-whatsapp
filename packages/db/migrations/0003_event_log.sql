-- ============================================================
-- 0003 — Registro de eventos
--
-- Cada cosa importante que hace el sistema deja una fila acá: un turno
-- contestado, un aviso al grupo, un error. Es lo que permite responder
-- "¿por qué el bot hizo esto?" tres días después, sin reproducir nada.
--
-- Dos reglas de uso:
--
-- 1. Acá va el RESUMEN estructurado, nunca el texto del cliente — el
--    texto ya vive en `messages` y duplicarlo infla la tabla y desparrama
--    datos personales.
--
-- 2. Grabar un evento jamás puede romper el flujo que lo emite. Por eso
--    el código lo inserta sin esperar el resultado (ver
--    apps/bot/src/observability/events.ts).
-- ============================================================

create table if not exists public.event_log (
  id              uuid primary key default gen_random_uuid(),
  -- A qué conversación pertenece, si aplica. Los eventos de crons o de
  -- arranque van sin conversación.
  conversation_id uuid references public.conversations(id) on delete set null,
  event_type      text not null,
  severity        text not null default 'info' check (severity in ('info', 'warn', 'error')),
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- Los dos accesos reales: "qué pasó en este chat" y "qué pasó hoy".
create index if not exists idx_event_conv    on public.event_log (conversation_id, created_at desc);
create index if not exists idx_event_created on public.event_log (created_at desc);
create index if not exists idx_event_type    on public.event_log (event_type, created_at desc);

alter table public.event_log enable row level security;

do $$
begin
  begin
    create policy equipo on public.event_log for all to authenticated using (true) with check (true);
  exception when duplicate_object then null;
  end;
end $$;
