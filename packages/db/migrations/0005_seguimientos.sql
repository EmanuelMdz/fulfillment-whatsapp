-- ============================================================
-- 0005 — Seguimientos automáticos
--
-- El cliente que dejó de contestar no está perdido: está ocupado. Un
-- recordatorio bien puesto a las 2-3 horas recupera una parte enorme de
-- esas conversaciones — es de las piezas que más plata mueven de todo el
-- sistema.
--
-- El ciclo completo:
--   1. Después de contestar un turno, la IA decide si programa
--      recordatorios y los deja acá (apps/bot/src/agents/followup.ts).
--   2. Un trabajador levanta los vencidos y los manda por la cola de
--      envío (apps/bot/src/workers/followups.ts).
--   3. Si el cliente escribe antes, se cancelan: contestarle a alguien
--      que acaba de hablar con un recordatorio viejo queda ridículo.
-- ============================================================

create table if not exists public.followups (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message         text not null,
  scheduled_at    timestamptz not null,
  -- pending   → esperando su hora
  -- sent      → salió (a la cola de envío)
  -- cancelled → el cliente escribió antes, o el chat pasó a una persona
  -- failed    → no se pudo mandar
  status          text not null default 'pending'
                  check (status in ('pending', 'sent', 'cancelled', 'failed')),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index if not exists idx_fu_due  on public.followups (scheduled_at) where status = 'pending';
create index if not exists idx_fu_conv on public.followups (conversation_id, created_at desc);

-- Reclamar los seguimientos vencidos. El `for update skip locked` evita
-- que dos procesos manden el mismo recordatorio (pasó en producción: el
-- mismo "¿seguís por ahí?" dos veces, con dos segundos de diferencia).
-- Se marcan 'sent' al reclamar: el envío real es un insert en la cola,
-- casi infalible; si aun así falla, el trabajador lo pasa a 'failed'.
create or replace function public.claim_due_followups(max_batch int default 5)
returns setof public.followups
language sql
as $$
  update public.followups f
     set status = 'sent', sent_at = now()
   where f.id in (
     select id
       from public.followups
      where status = 'pending'
        and scheduled_at <= now()
      order by scheduled_at
        for update skip locked
      limit max_batch
   )
  returning f.*;
$$;

alter table public.followups enable row level security;

do $$
begin
  begin
    create policy equipo on public.followups for all to authenticated using (true) with check (true);
  exception when duplicate_object then null;
  end;
end $$;

-- ------------------------------------------------------------
-- Prompt de arranque para los seguimientos. Como los demás, el dueño lo
-- reescribe desde el panel — este es el piso genérico.
-- ------------------------------------------------------------
insert into public.prompts (section, content)
select 'seguimientos', E'Tu trabajo es decidir si esta conversación merece un recordatorio más tarde, y escribirlo.\n\nReglas:\n- El recordatorio retoma LO ÚLTIMO que quedó pendiente: si el negocio dejó una pregunta en el aire, volvé sobre ESA pregunta. Un "¿seguís por ahí?" genérico cuando había una pregunta concreta está mal.\n- Escribí como una persona que retoma una conversación, no como un sistema de avisos.\n- Si la conversación terminó bien, si el cliente dijo que no, o si pidió que no le escriban: ningún recordatorio.\n- Nunca inventes que hay un pedido anotado o algo reservado si no lo hay.'
where not exists (select 1 from public.prompts where section = 'seguimientos' and channel is null);
