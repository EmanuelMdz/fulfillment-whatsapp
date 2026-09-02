-- ============================================================
-- 0010 — El asistente de instalación del panel
--
-- La instalación dejó de ser un script de terminal: el panel guía al
-- dueño (pegar un SQL en Supabase, elegir el pack, crear su usuario).
--
-- install_token: lo trae el SQL que el dueño pega en Supabase. Es la
-- prueba de que quien termina la instalación desde el navegador es
-- quien tiene acceso a esa base — sin esto, cualquiera que encontrara
-- la URL antes que el dueño podría crearse el usuario. Se borra al
-- terminar.
-- ============================================================

alter table public.app_config
  add column if not exists install_token text,
  add column if not exists installed_at  timestamptz;
