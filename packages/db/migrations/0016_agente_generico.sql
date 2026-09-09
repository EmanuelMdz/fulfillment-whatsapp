-- La base pasa a ser un agente genérico. Se conservan las tablas históricas
-- y los prompts de negocios instalados; ninguna conversión pisa datos reales.
alter table public.app_config alter column pack set default 'agent';
update public.app_config set pack = 'agent', labels = '{"contact":"Lead","contact_plural":"Leads"}',
  order_stages = '[]', escalation_reasons = '[]'
where installed_at is null;

update public.prompts set content = $agent$## Quién sos
Sos el asistente de este negocio. Respondés de forma clara, breve y cordial.

## Objetivo
Atender consultas usando la información de este prompt. El dueño puede reemplazar este objetivo por el que necesite.

## Información del negocio
Todavía no se cargó información. Si falta un dato, decilo y ofrecé pasar la consulta al equipo. No inventes links ni información.

## Datos del lead
Guardá la información que la persona comparta y sea relevante para atender su consulta. No exijas datos que no hagan falta.

## Cuándo derivar
Si la persona pide hablar con alguien del equipo, derivá e indicá el motivo.

## Seguimientos
Por ahora no programes seguimientos. El dueño debe definir acá cuándo corresponden, cuántos enviar y cuándo dejar de escribir.
$agent$
where section = 'sistema' and channel is null
  and exists (select 1 from public.app_config where installed_at is null);

-- Fusionar claves en SQL evita perder datos si el equipo y la IA actualizan
-- la ficha a la vez. La identidad y el acceso siguen protegidos por el servidor.
create or replace function public.merge_lead_data(lead_id uuid, new_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(new_data) <> 'object' then raise exception 'Los datos deben ser un objeto'; end if;
  update public.contacts set
    collected = collected || new_data,
    name = case when trim(name) = '' and nullif(trim(new_data->>'nombre_completo'), '') is not null
      then new_data->>'nombre_completo' else name end
  where id = lead_id;
end $$;
revoke all on function public.merge_lead_data(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_lead_data(uuid, jsonb) to service_role;

-- Un mensaje nuevo o la toma de control durante la llamada al modelo invalida
-- el plan. El mismo bloqueo de la recepción decide quién llegó primero.
create or replace function public.schedule_followup_if_current(
  conversation_uuid uuid, inbound_id uuid, followup_message text, due_at timestamptz
) returns boolean language plpgsql security definer set search_path = public as $$
declare current_conversation public.conversations;
begin
  select * into current_conversation from public.conversations where id = conversation_uuid for update;
  if not found or current_conversation.state <> 'bot'
    or current_conversation.last_inbound_id is distinct from inbound_id then return false; end if;
  if due_at <= now() then return false; end if;
  insert into public.followups(conversation_id, message, scheduled_at)
    values (conversation_uuid, followup_message, due_at);
  return true;
end $$;
revoke all on function public.schedule_followup_if_current(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.schedule_followup_if_current(uuid, uuid, text, timestamptz) to service_role;
