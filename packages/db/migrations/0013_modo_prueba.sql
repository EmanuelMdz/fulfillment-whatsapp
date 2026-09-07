-- ============================================================
-- 0013 — Modo prueba: el bot solo le contesta a tus números
--
-- El momento más delicado de una instalación es el primero: el número
-- del negocio ya está vinculado, pero el prompt todavía no está afinado
-- y el catálogo está a medias. Si en ese rato escribe un cliente real,
-- el bot le contesta cualquier cosa.
--
-- Con el modo prueba prendido, el bot SOLO responde a los números de
-- la lista. Lo que escriban los demás se guarda y se ve en el panel
-- (así no se pierde nada y una persona puede contestar a mano), pero el
-- bot no abre la boca.
--
-- Se apaga cuando el alumno pasó las pruebas y el negocio está listo.
-- ============================================================

alter table public.app_config
  -- Prendido = el bot solo contesta a test_numbers.
  add column if not exists test_mode    boolean not null default false,
  -- Los números autorizados, como los escribió el dueño ("099123456",
  -- "+598 99 123 456"). La comparación normaliza a dígitos y compara por
  -- el final, así da igual si puso el código de país o no.
  add column if not exists test_numbers jsonb not null default '[]'::jsonb;
