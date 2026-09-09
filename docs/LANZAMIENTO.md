# Estado de lanzamiento · 8 de septiembre de 2026

## Alcance vigente

Motor de WhatsApp con leads, conversaciones, control humano y seguimientos.
El objetivo, los links, la información, las etapas y la cadencia viven en el prompt.
La instalación y el panel iniciales ya no incluyen catálogo, pedidos ni packs.

- El turno ejecuta mensajes, datos y derivación en texto libre.
- La ficha del lead vuelve como contexto y se actualiza con un merge atómico.
- Los seguimientos leen la última respuesta y aceptan la cadencia del prompt.
  Se descartan horas inválidas sin reemplazarlas por horarios inventados.
- La migración 0016 agrega el registro de seguimientos condicionado a que el
  turno siga vigente. Conserva tablas históricas y prompts de negocios instalados.
- Guías, prompt inicial, demo y puesta en marcha siguen el alcance genérico.

## Verificación local de esta revisión

- `npm run check`: tests aislados, TypeScript y build aprobados.
- SQL: instalación nueva, preservación de una instalación anterior, merge de
  ficha, cancelación de planes obsoletos y permisos de los RPC verificados en PGlite.
- `npm audit`: sin vulnerabilidades reportadas.
- Revisión visual pendiente: no había navegador disponible en esta sesión.
- No se aplicaron migraciones a cuentas reales ni se enviaron mensajes.

Antes de publicar: ensayar una instalación vacía con Supabase, Railway, el
modelo de IA elegido y teléfonos reales según PRUEBAS.md; validar WAHA y fijar
su versión; revisar escritorio/teléfono, licencia y empaquetado de la entrega.

Lo siguiente es registro histórico de la revisión anterior. Sus referencias
a catálogo, pedidos y packs no describen el alcance vigente.

---

# Estado de lanzamiento · 7 de septiembre de 2026

Documento para el autor. **Preparado para validar la entrega; todavía no
certificado con Supabase, Railway y teléfonos reales en una instalación nueva.**

## Qué se entrega

Propuesta: **“Instalá un asistente que atienda consultas, use tu catálogo y
derive pedidos al equipo desde WhatsApp.”** El primer logro del alumno es
una conversación en el simulador; el segundo, un mensaje real en modo prueba.

No anunciar como disponibles inventario, pagos, audios, fotos interpretadas,
logística ni agenda. Tampoco ventas cerradas automáticamente, costo cero,
ausencia de riesgo de bloqueo ni una instalación completa en veinte minutos.

## Resuelto en esta revisión

| Problema | Cambio |
|---|---|
| No había recorrido desde duplicar el repo | README y PRIMEROS_PASOS orientados al primer resultado |
| Node y dependencias variables | Node 24, `npm ci`, lockfile y CI en Windows/Linux |
| Sin pruebas automáticas | Tests de Postgres, instalador, WAHA, permisos, demo y configuración |
| Repetir SQL podía repetir siembras o importar usuarios | Registro atómico, privado y omisión de migraciones aplicadas |
| Asistente interrumpido podía dejar al dueño sin acceso | Finalización en una transacción y recuperación de Auth al reintentar |
| Bot abierto a todos al instalar | Modo prueba inicial; filtro antes/después de generar y antes de enviar |
| Miembros podían cambiar contraseñas del dueño | Administración de usuarios y migraciones reservada al dueño |
| WAHA conservaba el webhook anterior | Actualización de la configuración de sesión antes de reiniciar |
| Peticiones podían frenar los trabajadores indefinidamente | Límites de tiempo en WAHA, IA y API administrativa de Supabase |
| Fallos de persistencia se confundían con duplicados | Recepción y agenda atómicas; 503 para reintentar sin duplicar |
| Demo con teléfonos posibles y borrado por prefijo | Destinos `demo:`, marca explícita, seguimientos cancelados y errores comprobados |
| Avisos de seguridad en React Router | Actualización a v7, comprobada con build y tests |
| Guías con vacíos operativos | Dirección desde Docker, preservación del volumen, costos y recuperación |

## Obligatorio antes de la primera release

- [ ] **Definir licencia y permisos con Emanuel.** No se eligió licencia ni
      se concedieron derechos de redistribución por cuenta del autor.
- [ ] **Ensayar el camino publicado con un proyecto vacío**, usando el commit
      candidato exacto: asistente, login, simulador y todas las pruebas de
      PRUEBAS.md, incluyendo 12b y reconexión.
- [ ] **Ensayar el modo manual**, con claves de proyecto y SQL del panel.
- [ ] **Revisar la interfaz en escritorio y teléfono.** No había un navegador
      conectado disponible en esta sesión; la verificación visual quedó pendiente.
- [ ] **Fijar versión/digest de WAHA** después de validarlo. En esta revisión
      se probaron contratos simulados de su API, no un puente real.
- [ ] **Guardar todos los archivos de la entrega en Git.** Al empezar había
      muchos cambios previos y archivos nuevos de interfaz, guías y migraciones.
      Se conservaron; un push que omita esos archivos no equivale a lo probado.
- [ ] **Publicar una release identificable** con requisitos y límites.
      Habilitar Template repository si ese será el recorrido elegido.

No se desplegó, publicó ni envió ningún WhatsApp. Las migraciones nuevas están
en archivos; no se aplicaron al Supabase del autor. Los tests reemplazan las
credenciales del proceso y bloquean la red.

## Verificación local

- `npm run check`: tests aislados, TypeScript y build.
- Copia limpia en Windows: `npm ci` y `npm run check` terminaron correctamente,
  con 12 tests aprobados, sin `.env`, dependencias ni builds de la copia original.
  Linux está configurado en CI; no se ejecutó localmente en esta revisión.
- `npm audit`: sin vulnerabilidades reportadas tras actualizar el lockfile.
- `npm run doctor`: controles locales correctos. Enlaces locales de las guías
  revisados; sin coincidencias de patrones de claves de Supabase, Google u
  OpenAI en archivos publicables ni en el historial inspeccionado. Es una
  búsqueda acotada de patrones, no una certificación de ausencia de secretos.
- SQL: esquema desde cero, repetición sin duplicados, rollback, permisos y
  reintento tras fallar la agenda de un mensaje. PGlite emula los roles y
  `auth.jwt`; no verifica la infraestructura Auth/PostgREST de Supabase.
- Vite conserva el aviso de `/config.js`: es intencional, la configuración
  pública se sirve al ejecutar y no se incorpora al build.

## Mejoras para la experiencia del lead magnet

1. **Video con un fork vacío**, siguiendo la guía y mostrando el resultado de
   cada fase. Pedir a un alumno externo que lo complete sin ayuda privada.
2. **Demo grabada y caso ficticio completo**, del catálogo a la revisión humana.
3. **Canal concreto y alcance de soporte.** Hay plantilla de Issues, pero no
   una promesa de atención o tiempo de respuesta.
4. **Medir activación:** copia → panel instalado → simulador responde → prueba
   real. Landing, formulario, mensajes de entrega y analítica no se construyeron
   dentro de este repo.

## Robustez pendiente

- Una caída después de que WAHA acepta un envío y antes de registrar el éxito
  puede provocar repetición. No se promete entrega exactamente una vez.
- Falta ensayar reinicios, colas y seguimientos con servicios reales. No todas
  las ventanas de fallo entre servicios se resuelven con una transacción SQL.
- El modo prueba compara ocho dígitos y rechaza `@lid`: falta resolver esos
  identificadores a teléfonos verificados y normalizar números internacionalmente.
- Los miembros son de confianza y comparten datos y configuración. Permisos
  de operador más limitados requieren cambiar también las políticas de Supabase.
- Faltan mediciones de carga, costo por conversación, restauración de respaldos
  y funcionamiento sostenido con la versión de WAHA elegida.

## Fuentes verificadas

- [WAHA: sesiones y webhooks](https://waha.devlike.pro/docs/how-to/sessions/).
- [Railway: planes y uso incluido](https://docs.railway.com/pricing/plans).
- [Supabase: pausas](https://supabase.com/docs/guides/platform/free-project-pausing)
  y [respaldos](https://supabase.com/docs/guides/platform/backups).
- [Node: calendario](https://github.com/nodejs/Release).
- [Gemini: retiros de modelos](https://ai.google.dev/gemini-api/docs/deprecations).

Revisar tarifas, modelos y pantallas de proveedores antes de grabar el tutorial
y de publicar cada release.
