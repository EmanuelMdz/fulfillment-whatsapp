-- ============================================================
-- 0004 — Cola de revisión y llave general del bot
--
-- La cola de revisión es donde caen las conversaciones que necesitan una
-- persona: el cliente pidió un humano, mandó un comprobante, el bot se
-- trabó. El panel la muestra como bandeja de trabajo del equipo.
--
-- La llave general (`app_config.bot_enabled`) apaga al bot entero desde
-- el panel. Los mensajes se siguen GUARDANDO (una persona atendiendo a
-- mano necesita verlos), pero el bot no contesta ninguno.
-- ============================================================

alter table public.app_config
  add column if not exists bot_enabled boolean not null default true;

create table if not exists public.review_queue (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  -- Por qué está acá. O una clave de app_config.escalation_reasons (la
  -- eligió la IA) o una clave de sistema (loop_detectado, respuesta_vacia,
  -- repeticion — las puso una guarda del código).
  reason          text not null,
  detail          text not null default '',
  status          text not null default 'open' check (status in ('open', 'resolved')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

-- Una conversación tiene A LO SUMO un caso abierto. Si tres guardas
-- distintas escalan el mismo chat en un minuto, la cola muestra UNA fila,
-- no tres — el insert repetido choca acá y se ignora.
create unique index if not exists idx_review_one_open
  on public.review_queue (conversation_id) where status = 'open';

create index if not exists idx_review_open on public.review_queue (created_at desc) where status = 'open';

alter table public.review_queue enable row level security;

do $$
begin
  begin
    create policy equipo on public.review_queue for all to authenticated using (true) with check (true);
  exception when duplicate_object then null;
  end;
end $$;
