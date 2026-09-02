-- ============================================================
-- 0007 — Configuración desde el panel
--
-- Antes, las claves de IA, la dirección del puente de WhatsApp y los
-- tiempos del bot vivían en variables de entorno. Cada una era un lugar
-- más donde un alumno se podía equivocar, y un reinicio del servidor
-- por cada cambio. Ahora viven acá y se editan desde el panel.
--
-- Dos tablas distintas a propósito:
--   - app_config: lo que NO es secreto (modelo, URL del puente, tiempos).
--     El panel lo lee directo, como el resto de la configuración.
--   - app_secrets: las claves. Sin política para `authenticated`: el
--     navegador NO puede leerlas ni con sesión. Solo el servidor.
-- ============================================================

alter table public.app_config
  add column if not exists llm_provider      text not null default 'gemini',
  add column if not exists llm_model         text not null default 'gemini-2.5-flash',
  add column if not exists whatsapp_api_url  text not null default '',
  add column if not exists whatsapp_session  text not null default 'default',
  -- Vacío = se detecta sola (RAILWAY_PUBLIC_DOMAIN). Se completa a mano
  -- solo si el hosting no la informa.
  add column if not exists public_url        text not null default '',
  -- Símbolo o código que el panel muestra al lado de los precios.
  add column if not exists currency          text not null default '$',
  -- Cuánto espera el bot antes de contestar, para juntar mensajes sueltos.
  add column if not exists debounce_seconds  int  not null default 90,
  -- Pausa entre envíos. Es lo que protege al número. No bajar de 2000.
  add column if not exists send_pause_min_ms int  not null default 2000,
  add column if not exists send_pause_max_ms int  not null default 6000,
  -- Ventana nocturna de los seguimientos, en hora local del negocio.
  add column if not exists quiet_hours_start int  not null default 23,
  add column if not exists quiet_hours_end   int  not null default 9;

create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- RLS prendida y SIN política: ningún usuario del panel puede leer esto.
-- La clave de servicio (el servidor) saltea RLS y es la única que entra.
-- Ver apps/bot/src/config/settings.ts.
alter table public.app_secrets enable row level security;

-- La tabla de migraciones tampoco tiene por qué ser pública. Si esta
-- migración se pega a mano antes de que exista, se crea acá mismo.
create table if not exists public._migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
alter table public._migrations enable row level security;

-- ------------------------------------------------------------
-- Dos frases que le llegan al cliente y que estaban escritas en el
-- código. Son voz del negocio: una clínica no dice "Dale!". Van como
-- prompts, editables desde Studio.
-- ------------------------------------------------------------
insert into public.prompts (section, content)
select 'mensaje_puente', 'Dame un momentito que lo reviso y te escribo 🙌'
where not exists (select 1 from public.prompts where section = 'mensaje_puente' and channel is null);

insert into public.prompts (section, content)
select 'mensaje_pedido_anotado', 'Dale! Ya quedó anotado, apenas el equipo lo confirme te aviso por acá 🙌'
where not exists (select 1 from public.prompts where section = 'mensaje_pedido_anotado' and channel is null);
