-- Prestaciones de ejemplo para el Pack Servicios.
-- Sirve para que el bot tenga de qué hablar el primer día, antes de que
-- el dueño cargue lo suyo. Se borra sin miedo.
--
-- La configuración del pack (diccionario, estados, motivos) NO se siembra
-- acá: la escribe el instalador leyendo packages/core. Una sola fuente.

insert into public.catalog_items (name, kind, price, description, bot_info, sort)
values
  (
    'Consulta general', 'service', 1200,
    'Primera consulta, 30 minutos.',
    'Dura media hora. Traer estudios previos si los tiene. Si es primera vez, pedirle nombre completo y documento. Cubierta por la mayoría de las mutualistas: si preguntan por la suya, derivar a recepción antes de confirmar.',
    1
  ),
  (
    'Control', 'service', 800,
    'Seguimiento de un tratamiento en curso, 20 minutos.',
    'Solo para pacientes que ya vinieron. Dura 20 minutos. Si nunca vino, corresponde consulta general.',
    2
  ),
  (
    'Estudio de laboratorio', 'service', 1500,
    'Análisis completo con resultados en 48 horas.',
    'Hay que venir en ayunas de 8 horas. Los resultados salen en 48 horas hábiles y se mandan por correo. No hace falta turno previo, se atiende por orden de llegada de 7 a 10 de la mañana.',
    3
  ),
  (
    'Consulta por videollamada', 'service', 900,
    'Misma consulta, a distancia, 30 minutos.',
    'Se hace por videollamada. Se manda el link una hora antes. No sirve para casos que necesiten revisación fisica: en ese caso ofrecer consulta presencial.',
    4
  )
on conflict do nothing;
