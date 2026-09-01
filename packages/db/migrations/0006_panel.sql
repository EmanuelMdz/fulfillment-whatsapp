-- ============================================================
-- 0006 — Vista para el panel
--
-- La lista de conversaciones necesita, por cada chat: el último mensaje,
-- cuándo fue, quién lo mandó y si hay un caso de revisión abierto. Eso
-- son tres consultas por fila si se hace desde el navegador; esta vista
-- lo resuelve en una.
--
-- `security_invoker = on` a propósito: la vista corre con los permisos
-- de QUIEN consulta, así las policies de las tablas de abajo siguen
-- mandando. Una vista sin esto saltea la seguridad de fila sin avisar.
-- ============================================================

create or replace view public.v_conversations_overview
with (security_invoker = on) as
select
  c.id,
  c.channel,
  c.chat_id,
  c.state,
  c.contact_id,
  ct.name  as contact_name,
  ct.phone as contact_phone,
  lm.body       as last_message,
  lm.author     as last_author,
  lm.created_at as last_message_at,
  rq.reason     as review_reason
from public.conversations c
left join public.contacts ct on ct.id = c.contact_id
left join lateral (
  select m.body, m.author, m.created_at
    from public.messages m
   where m.conversation_id = c.id
   order by m.created_at desc
   limit 1
) lm on true
left join lateral (
  select r.reason
    from public.review_queue r
   where r.conversation_id = c.id
     and r.status = 'open'
   limit 1
) rq on true;
