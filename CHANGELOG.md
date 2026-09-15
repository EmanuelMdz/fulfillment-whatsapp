# Cambios

Cada versión se publica en **Releases** con su etiqueta (`v0.2.0`) y el zip
del código. Para incorporarla a tu copia seguí
[Actualizar a una versión nueva](docs/OPERACION.md#actualizar-a-una-versión-nueva).

En cada versión: qué cambia, si trae migraciones y qué archivos conviene
revisar si modificaste tu copia.

## v0.2.0 — primera versión pública

Sin publicar todavía.

**Qué incluye**

- Agente genérico: el objetivo, la información, los datos a guardar, la
  derivación y los seguimientos se definen en el prompt de Studio.
  La instalación inicial no pide catálogo, pedidos ni rubro.
- WhatsApp por QR mediante WAHA, conversaciones, respuesta humana y
  devolución al bot, leads con ficha, revisión y avisos al equipo, métricas,
  usuarios y modo prueba.
- Simulador de conversación y prueba de seguimientos.
- Instalación con dos variables (`SUPABASE_URL` y `SUPABASE_ACCESS_TOKEN`):
  el servidor crea las tablas al arrancar y cierra los registros abiertos.
- El asistente confirma al dueño con el mismo token cargado en el hosting.
  Siguen valiendo sus últimos 8 caracteres.
- WAHA fijado en `devlikeapro/waha:latest-2026.8.2` en las guías y en
  `docker-compose.yml`.

**Base de datos**

Migraciones `0001` a `0016`. Las propias de cada copia empiezan en `9001`.

**Requisitos**

Node.js 24, un proyecto de Supabase, Railway o un servidor con Docker, WAHA
con un número dedicado y una clave de IA propia.
