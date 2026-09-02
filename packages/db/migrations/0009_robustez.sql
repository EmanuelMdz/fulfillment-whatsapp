-- ============================================================
-- 0009 — Lo que pasa cuando el servidor se reinicia en el peor momento
--
-- Railway redespliega en cada push. Si el proceso muere justo entre
-- reclamar un trabajo y terminarlo, ese trabajo quedaba perdido sin que
-- nadie se entere. Tres arreglos, uno por cola.
-- ============================================================

-- ------------------------------------------------------------
-- Cola de envío: reclama también lo que quedó en 'sending' hace más de
-- tres minutos — el proceso murió en el medio. Cuenta como un intento
-- más, así después de tres muertes seguidas se rinde igual que una
-- falla normal.
-- ------------------------------------------------------------
create or replace function public.claim_next_send()
returns setof public.send_queue
language sql
as $$
  update public.send_queue q
     set status = 'sending',
         claimed_at = now(),
         attempts = q.attempts + 1
   where q.id = (
     select id
       from public.send_queue
      where status = 'pending'
         or (status = 'sending' and claimed_at < now() - interval '3 minutes')
      order by created_at
        for update skip locked
      limit 1
   )
  returning q.*;
$$;

-- ------------------------------------------------------------
-- Turnos: reclamar un turno es poner respond_after en null. Si el
-- proceso muere después de reclamar y antes de encolar la respuesta,
-- la conversación queda en manos del bot, sin turno, con el cliente
-- esperando. Al arrancar, el servidor llama a esto: las conversaciones
-- del bot sin turno cuyo último mensaje es del cliente, tiene más de
-- dos minutos (menos es una respuesta que todavía está en la cola de
-- envío) y menos de un día, vuelven a tener turno.
-- ------------------------------------------------------------
create or replace function public.recover_unanswered_turns(delay_seconds int default 30)
returns int
language plpgsql
as $$
declare n int;
begin
  update public.conversations c
     set respond_after = now() + make_interval(secs => delay_seconds)
   where c.state = 'bot'
     and c.respond_after is null
     and (
       select m.author from public.messages m
        where m.conversation_id = c.id
        order by m.created_at desc limit 1
     ) = 'customer'
     and (
       select max(m.created_at) from public.messages m where m.conversation_id = c.id
     ) between now() - interval '24 hours' and now() - interval '2 minutes'
     and not exists (
       select 1 from public.send_queue s
        where s.conversation_id = c.id and s.status in ('pending', 'sending')
     );
  get diagnostics n = row_count;
  return n;
end $$;

-- ------------------------------------------------------------
-- Registro de eventos: cada turno graba varias filas; en un año son
-- cientos de miles. Se borra lo que tenga más de N días, una vez por
-- día (lo llama el trabajador de seguimientos).
-- ------------------------------------------------------------
create or replace function public.cleanup_event_log(keep_days int default 90)
returns int
language plpgsql
as $$
declare n int;
begin
  delete from public.event_log
   where created_at < now() - make_interval(days => keep_days);
  get diagnostics n = row_count;
  return n;
end $$;
