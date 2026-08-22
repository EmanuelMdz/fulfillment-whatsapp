-- ============================================================
-- 0002 — El bot
--
-- Conversaciones, mensajes, cola de envío, prompts y episodios de aviso.
--
-- Dos ideas de diseño que conviene entender antes de tocar algo acá:
--
-- 1. NADIE MANDA MENSAJES DIRECTAMENTE. Todo se escribe en `send_queue` y
--    un solo trabajador la vacía de a uno con pausas. Es lo que evita que
--    WhatsApp bloquee el número. Ver claim_next_send() abajo.
--
-- 2. EL BOT NO ESPERA EN MEMORIA. Cuando llega un mensaje se anota en
--    `conversations.respond_after` cuándo hay que contestar, y un trabajador
--    lo levanta cuando llega la hora. Si el servidor se reinicia en el medio,
--    el turno sigue ahí. Un `setTimeout` se habría perdido.
-- ============================================================

-- ------------------------------------------------------------
-- Conversaciones. Una por contacto y canal.
-- ------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references public.contacts(id) on delete set null,
  channel     text not null default 'whatsapp',
  -- Identificador del chat del lado del proveedor (JID de WhatsApp, id de IG).
  chat_id     text not null,

  -- 'bot'    → contesta la IA
  -- 'humano' → alguien tomó el control, la IA no habla
  -- 'cerrado'→ terminada
  state       text not null default 'bot' check (state in ('bot', 'humano', 'cerrado')),
  intent      text,

  -- Cuándo hay que correr el turno. Null = no hay turno pendiente.
  -- Ponerlo en null es la forma de RECLAMAR el turno: ver claim_due_turns().
  respond_after   timestamptz,
  -- El último mensaje entrante al momento de agendar el turno. Si cuando
  -- llega la hora ya no es el último, llegó otro mensaje y este turno se
  -- descarta: contesta el que viene atrás, con todo junto.
  last_inbound_id uuid,

  -- Cuándo entró un humano y cuándo devolvió la conversación.
  -- INVARIANTE: evidencia humana anterior a handback_at NUNCA vuelve a
  -- pausar el bot. Sin esto la conversación rebota entre humano y bot
  -- para siempre.
  human_at     timestamptz,
  handback_at  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (channel, chat_id)
);

create index if not exists idx_conv_due     on public.conversations (respond_after) where respond_after is not null;
create index if not exists idx_conv_state   on public.conversations (state);
create index if not exists idx_conv_contact on public.conversations (contact_id);

-- ------------------------------------------------------------
-- Mensajes. Espejo de lo que pasa en el chat, en los dos sentidos.
--
-- El único índice que importa de verdad es el de external_id: el webhook
-- puede llegar dos veces por el mismo mensaje y no queremos duplicados.
-- ------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  external_id     text,
  direction       text not null check (direction in ('in', 'out')),
  -- Quién lo escribió. 'human' es alguien del negocio contestando a mano:
  -- por eso mismo el bot se calla.
  author          text not null check (author in ('customer', 'bot', 'human')),
  body            text not null default '',
  media_url       text,
  media_kind      text,
  provider_ts     timestamptz,
  created_at      timestamptz not null default now()
);

create unique index if not exists idx_msg_external on public.messages (conversation_id, external_id) where external_id is not null;
create index if not exists idx_msg_conv on public.messages (conversation_id, created_at desc);

-- ------------------------------------------------------------
-- Cola de envío. El carril único por donde sale TODO.
-- ------------------------------------------------------------
create table if not exists public.send_queue (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  channel         text not null default 'whatsapp',
  chat_id         text not null,
  body            text not null,
  -- Quién pidió el envío. Sirve para saber qué guardar en messages.
  author          text not null default 'bot' check (author in ('bot', 'human')),
  status          text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts        int not null default 0,
  last_error      text,
  claimed_at      timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_queue_pending on public.send_queue (created_at) where status = 'pending';

-- ------------------------------------------------------------
-- Prompts. Lo que la IA es y cómo habla, editable desde el panel.
--
-- El unique es sobre (section, canal) con el canal nulo colapsado a un
-- texto: así conviven un prompt general y uno específico de Instagram.
-- OJO: es un índice de EXPRESIÓN, así que `on conflict` no lo puede usar.
-- Los prompts se escriben con update, nunca con upsert.
-- ------------------------------------------------------------
create table if not exists public.prompts (
  id         uuid primary key default gen_random_uuid(),
  section    text not null,
  channel    text,
  content    text not null default '',
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_prompts_section
  on public.prompts (section, coalesce(channel, '_default'));

-- ------------------------------------------------------------
-- Episodios de aviso. Un aviso reclama su episodio antes de salir; si la
-- fila ya existía, no sale. Es lo que hace que reprocesar un turno no le
-- mande dos veces lo mismo al grupo.
-- ------------------------------------------------------------
create table if not exists public.notification_episodes (
  scope       text not null,
  kind        text not null,
  episode_key text not null,
  created_at  timestamptz not null default now(),
  primary key (scope, kind, episode_key)
);

-- ------------------------------------------------------------
-- Reclamar el próximo mensaje a enviar.
--
-- El `for update skip locked` es lo que hace que dos procesos no puedan
-- agarrar el mismo mensaje. Sin eso, un reinicio con dos instancias vivas
-- manda todo duplicado.
--
-- Ojo: esto garantiza que no se envíe dos veces, pero NO garantiza el ritmo.
-- El ritmo depende de que haya un solo trabajador. Por eso el despliegue va
-- con una sola réplica — ver docs/DEPLOY.md.
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
      order by created_at
        for update skip locked
      limit 1
   )
  returning q.*;
$$;

-- ------------------------------------------------------------
-- Reclamar las conversaciones a las que les llegó la hora de contestar.
--
-- Poner respond_after en null ES el reclamo: la próxima corrida ya no las ve.
-- ------------------------------------------------------------
create or replace function public.claim_due_turns(max_batch int default 5)
returns setof public.conversations
language sql
as $$
  update public.conversations c
     set respond_after = null
   where c.id in (
     select id
       from public.conversations
      where respond_after is not null
        and respond_after <= now()
        and state = 'bot'
      order by respond_after
        for update skip locked
      limit max_batch
   )
  returning c.*;
$$;

-- ------------------------------------------------------------
-- Seguridad
-- ------------------------------------------------------------
alter table public.conversations         enable row level security;
alter table public.messages              enable row level security;
alter table public.send_queue            enable row level security;
alter table public.prompts               enable row level security;
alter table public.notification_episodes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['conversations', 'messages', 'send_queue', 'prompts', 'notification_episodes']
  loop
    begin
      execute format(
        'create policy equipo on public.%I for all to authenticated using (true) with check (true)',
        t
      );
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

do $$
begin
  begin
    create trigger conversations_touch before update on public.conversations
      for each row execute function public.touch_updated_at();
  exception when duplicate_object then null;
  end;
end $$;

-- ------------------------------------------------------------
-- Prompts de arranque. Genéricos a propósito: el dueño los reescribe
-- desde el panel y ahí es donde el bot deja de sonar a robot.
-- ------------------------------------------------------------
insert into public.prompts (section, content)
select 'identidad', 'Sos quien atiende los mensajes de este negocio. Hablás como una persona real: claro, breve y cordial. Tuteás. No usás lenguaje de folleto ni prometés nada que no esté escrito en la información del negocio.'
where not exists (select 1 from public.prompts where section = 'identidad' and channel is null);

insert into public.prompts (section, content)
select 'atencion', E'Tu trabajo es responder consultas y ayudar a avanzar.\n\nReglas:\n- Contestá solo con la información que tenés. Si no la tenés, decilo y ofrecé averiguarlo.\n- Nunca inventes precios, plazos ni disponibilidad.\n- No ofrezcas descuentos que no estén publicados.\n- Mensajes cortos, como los que escribiría una persona por WhatsApp.\n- Si el cliente pide algo que requiere una persona, decíselo y avisá que ya lo derivás.'
where not exists (select 1 from public.prompts where section = 'atencion' and channel is null);
