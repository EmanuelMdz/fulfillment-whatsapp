-- ============================================================
-- 0012 — El estado de la sesión de WhatsApp, guardado
--
-- Hasta acá, si el número se desconectaba (alguien cerró la sesión
-- desde el teléfono, el puente se redesplegó sin volumen, WhatsApp
-- cortó), el bot quedaba mudo y NADIE se enteraba: el aviso al grupo
-- sale por el mismo WhatsApp que está caído.
--
-- Ahora un vigilante mira la sesión cada dos minutos y deja acá lo que
-- vio. El panel lo muestra en rojo arriba de todo, y el registro de
-- eventos guarda cuándo se cayó y cuándo volvió.
-- ============================================================

alter table public.app_config
  add column if not exists whatsapp_status    text,
  add column if not exists whatsapp_status_at timestamptz;
