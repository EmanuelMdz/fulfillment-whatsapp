-- ============================================================
-- 0011 — Un solo prompt, en markdown
--
-- Un modelo de lenguaje recibe UN texto de sistema. Tenerlo partido en
-- tres cajas (identidad, atención, seguimientos) más dos mensajes fijos
-- era una complicación nuestra, no del modelo: el dueño no entendía por
-- qué había cinco cosas para editar. Ahora hay una sección `sistema`:
-- un texto en markdown que el negocio escribe con sus secciones, y el
-- código le agrega abajo lo mecánico (fecha, catálogo, motivos, formato).
--
-- Las instalaciones que ya editaron sus prompts no pierden nada: los
-- tres textos se concatenan con un título cada uno. Los mensajes fijos
-- se van: el "quedó anotado" lo dice el modelo con la voz del negocio
-- (el contrato se lo pide), y el puente es una red de seguridad del
-- código, no un texto del negocio.
-- ============================================================

do $$
declare
  ident text;
  aten  text;
  seg   text;
  nuevo text;
begin
  if exists (select 1 from public.prompts where section = 'sistema' and channel is null) then
    return;
  end if;

  select content into ident from public.prompts where section = 'identidad' and channel is null;
  select content into aten  from public.prompts where section = 'atencion'  and channel is null;
  select content into seg   from public.prompts where section = 'seguimientos' and channel is null;

  nuevo := concat_ws(
    E'\n\n',
    case when ident is not null then E'## Quién sos\n' || ident end,
    case when aten  is not null then E'## Cómo atendés\n' || aten end,
    case when seg   is not null then E'## Seguimientos\n' || seg end
  );

  if nuevo is null or nuevo = '' then
    nuevo := E'## Quién sos\nSos quien atiende los mensajes de este negocio. Hablás como una persona real: claro, breve y cordial. Tuteás. No usás lenguaje de folleto ni prometés nada que no esté escrito en la información del negocio.\n\n## Reglas\n- Contestá solo con la información que tenés. Si no la tenés, decilo y ofrecé averiguarlo.\n- Nunca inventes precios, plazos ni disponibilidad.\n- No ofrezcas descuentos que no estén publicados.\n- Mensajes cortos, como los que escribiría una persona por WhatsApp.\n- Si el cliente pide algo que requiere una persona, decíselo y avisá que ya lo derivás.\n\n## Seguimientos\n- El recordatorio retoma LO ÚLTIMO que quedó pendiente. Un "¿seguís por ahí?" genérico cuando había una pregunta concreta está mal.\n- Escribí como una persona que retoma una conversación, no como un sistema de avisos.\n- Si la conversación terminó bien, si el cliente dijo que no, o si pidió que no le escriban: ningún recordatorio.';
  end if;

  insert into public.prompts (section, content) values ('sistema', nuevo);

  delete from public.prompts
   where section in ('identidad', 'atencion', 'seguimientos', 'mensaje_puente', 'mensaje_pedido_anotado');
end $$;
