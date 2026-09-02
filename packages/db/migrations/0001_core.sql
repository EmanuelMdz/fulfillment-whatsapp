-- ============================================================
-- 0001 — Núcleo
--
-- Lo que existe en TODA instalación, sea una tienda o una clínica.
-- Las tablas del bot (conversaciones, mensajes, seguimientos) llegan
-- en 0002 con el porteo de la tanda 1.
--
-- Una instalación = un negocio = una base. No hay tenant_id a propósito:
-- ver docs/DECISIONES.md.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Configuración del negocio. Una sola fila, siempre id = 1.
--
-- Acá viven las tres listas que hacen que el mismo sistema se sienta
-- nativo en rubros distintos: el diccionario de palabras, los estados
-- por los que pasa un pedido y los motivos por los que la IA deriva
-- a una persona. Son datos, no código.
-- ------------------------------------------------------------
create table if not exists public.app_config (
  id                 smallint primary key default 1 check (id = 1),
  pack               text not null default 'ecommerce',
  business_name      text not null default '',
  timezone           text not null default 'America/Montevideo',
  labels             jsonb not null default '{}'::jsonb,
  order_stages       jsonb not null default '[]'::jsonb,
  escalation_reasons jsonb not null default '[]'::jsonb,
  -- Solo se respeta con el módulo 'hours' prendido.
  business_hours     jsonb not null default '{}'::jsonb,
  -- Grupo o número que recibe los avisos.
  notify_chat_id     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Módulos prendidos. El panel arma su menú leyendo esto y el
-- servidor saltea los pasos de los que están apagados.
-- ------------------------------------------------------------
create table if not exists public.modules (
  key        text primary key,
  enabled    boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Contactos. Cliente en una tienda, paciente en una clínica.
-- ------------------------------------------------------------
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  phone      text unique,
  email      text,
  notes      text not null default '',
  -- Lo que la IA fue juntando en la conversación. Es la ficha que
  -- pre-llena el formulario cuando se crea un pedido desde un chat.
  collected  jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Catálogo. Producto en una tienda, prestación en una clínica.
--
-- `bot_info` es lo que la IA sabe de esto y puede contar: la ficha
-- larga, en texto libre. Es lo que más mueve la aguja de la calidad
-- de las respuestas.
-- ------------------------------------------------------------
create table if not exists public.catalog_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'product' check (kind in ('product', 'service')),
  price       int  not null default 0,
  currency    text not null default 'UYU',
  description text not null default '',
  bot_info    text not null default '',
  image_url   text,
  active      boolean not null default true,
  sort        int not null default 0,
  -- Solo se usan con el módulo 'stock' prendido.
  track_stock boolean not null default false,
  stock_qty   int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Pedidos. Venta en una tienda, consulta en una clínica.
--
-- SIN envío, sin guía, sin cadetería: eso es del módulo 'shipping'
-- y cada quien lo resuelve con su conector.
--
-- `stage` no es un enum a propósito: los estados salen de
-- app_config.order_stages, que el dueño edita desde el panel.
-- ------------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references public.contacts(id) on delete set null,
  items        jsonb not null default '[]'::jsonb,
  total        int not null default 0,
  stage        text not null default 'nuevo',
  source       text not null default 'manual' check (source in ('manual', 'bot')),
  notes        text not null default '',
  -- Para servicios: cuándo es el turno. Null en ecommerce.
  scheduled_at timestamptz,
  -- Solo se usa con el módulo 'team' prendido.
  assigned_to  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_orders_stage        on public.orders (stage);
create index if not exists idx_orders_created_at   on public.orders (created_at desc);
create index if not exists idx_orders_contact      on public.orders (contact_id);
create index if not exists idx_orders_scheduled    on public.orders (scheduled_at) where scheduled_at is not null;
create index if not exists idx_catalog_active      on public.catalog_items (active, sort);
create index if not exists idx_contacts_phone      on public.contacts (phone);

-- ------------------------------------------------------------
-- Seguridad. Una instalación tiene un equipo, y todos ven todo.
-- Si mañana hace falta separar por rol, se agrega acá y en ningún
-- otro lado.
-- ------------------------------------------------------------
alter table public.app_config    enable row level security;
alter table public.modules       enable row level security;
alter table public.contacts      enable row level security;
alter table public.catalog_items enable row level security;
alter table public.orders        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['app_config', 'modules', 'contacts', 'catalog_items', 'orders']
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

-- ------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['app_config', 'contacts', 'catalog_items', 'orders']
  loop
    begin
      execute format(
        'create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',
        t, t
      );
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------
-- Fila única de configuración. El instalador la completa según el
-- pack elegido (ver packages/db/seeds/).
-- ------------------------------------------------------------
insert into public.app_config (id) values (1) on conflict (id) do nothing;
