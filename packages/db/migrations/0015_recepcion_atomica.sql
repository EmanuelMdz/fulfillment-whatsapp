-- Si guardar un mensaje funciona pero agendarlo falla, el reintento no
-- puede descartarse como duplicado. Toda la recepción va en una transacción.
create or replace function public.receive_customer_message(
  conversation_id_arg uuid, external_id_arg text, body_arg text,
  media_url_arg text, media_kind_arg text, provider_ts_arg timestamptz,
  can_respond boolean, delay_seconds int
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare message_id uuid;
begin
  perform 1 from public.conversations where id = conversation_id_arg for update;
  if not found then raise exception 'Conversación no encontrada'; end if;
  insert into public.messages (
    conversation_id, external_id, direction, author, body, media_url, media_kind, provider_ts
  ) values (
    conversation_id_arg, external_id_arg, 'in', 'customer', body_arg,
    media_url_arg, media_kind_arg, provider_ts_arg
  ) on conflict (conversation_id, external_id) where external_id is not null do nothing
  returning id into message_id;
  if message_id is null then return false; end if;

  update public.followups set status = 'cancelled'
    where conversation_id = conversation_id_arg and status = 'pending';
  update public.conversations set
    state = case when state = 'cerrado' then 'bot' else state end,
    last_inbound_id = message_id,
    respond_after = case when can_respond and state in ('bot', 'cerrado')
      then now() + make_interval(secs => greatest(0, delay_seconds)) else null end
    where id = conversation_id_arg;
  return true;
end $$;
revoke all on function public.receive_customer_message(uuid, text, text, text, text, timestamptz, boolean, int) from public, anon, authenticated;
grant execute on function public.receive_customer_message(uuid, text, text, text, text, timestamptz, boolean, int) to service_role;
