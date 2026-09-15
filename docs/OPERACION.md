# Operar y recuperar tu instalación

## Si algo falla

| Síntoma | Qué verificar | Resultado esperado |
|---|---|---|
| `npm` no existe | Instalá Node 24 LTS y reabrí la terminal | `node --version` empieza con `v24` |
| Falta `package.json` | Entrá a la raíz de tu copia | Ves `apps`, `packages` y `package.json` |
| Falta una variable | `npm run doctor`, luego `.env` o Variables en Railway | Formatos válidos, sin placeholders |
| Puerto ocupado | Usá el servidor que ya corre si es esta instalación; no abras otro | Un solo proceso del bot por base |
| Panel sin compilar | `npm run build`, luego reiniciá este servidor | Abre el asistente o login |
| Supabase responde 401/403 | Revisá token, proyecto y permisos en Supabase | El servidor puede consultar ese proyecto |
| Tabla o función no encontrada | Panel → Instalar, verificar/aplicar pendientes | No quedan migraciones pendientes |
| Se interrumpió el asistente | Refrescá el estado y reintentá con el mismo email | Si terminó, aparece login; si no, retoma sin duplicar la instalación |
| Falló el ingreso | Email/contraseña del panel, no la contraseña de Postgres | El usuario existe en Auth y en `team_members` |
| IA responde 401/403/404/429 | Studio → Probar clave y modelo; acceso, modelo, saldo/cuota | La prueba devuelve una respuesta |
| WAHA responde pero no llegan mensajes | URL del webhook alcanzable desde WAHA; guardá y arrancá la sesión nuevamente | Un mensaje nuevo aparece en Conversaciones |
| Llegan mensajes pero no responde | Bot prendido, clave de IA, modo prueba, teléfono autorizado y espera configurada | Por defecto espera 90 segundos para agrupar mensajes |
| El teléfono llega como `@lid` | El bot le pide al puente la traducción a teléfono; si no la conoce, agendá ese contacto en el teléfono del negocio o pegá el código `@lid` en los números autorizados | El bot le responde al número autorizado con el modo prueba prendido |
| WAHA recibe el mensaje pero no aparece en el panel | En los registros de WAHA, la línea `Configuring webhooks for…`: tiene que decir `https://`. Si dice `http://`, cargá la URL pública en Conexión → Avanzado y reiniciá la sesión | El webhook queda en https y los mensajes entran |
| Un chat de demo no permite enviar | Es el comportamiento esperado | Usá Probar el bot o un teléfono de prueba real |
| Cada redeploy pide QR | WAHA debe conservar `/app/.sessions` en un volumen | La sesión sobrevive al reinicio del contenedor |
| No llegan avisos | Studio → grupo del equipo; sesión conectada | La prueba de derivación deja un caso y un aviso |

`/health` confirma que el proceso responde, incluso si falta instalar la base.
No acredita una instalación completa ni garantiza que WhatsApp pueda enviar.
La verificación de extremo a extremo es [PRUEBAS.md](PRUEBAS.md).

## Actualizar a una versión nueva

Tu copia es independiente del repositorio del motor: una versión nueva no
llega sola. Cada versión se publica en Releases, con sus cambios en
`CHANGELOG.md` y el zip del código para comparar.

1. Leé qué cambia: si trae migraciones y si toca archivos que modificaste.
2. Anotá el commit desplegado, la versión/digest de WAHA y el proveedor/modelo.
   Prepará un respaldo de Supabase y registrá cómo restaurarlo. Si hay datos
   reales, probá la versión antes con otra base y otro número de prueba.
3. Traé los cambios a tu copia. Una sola vez, conectá el repositorio del motor:

   ```bash
   git remote add motor https://github.com/EmanuelMdz/fulfillment-whatsapp.git
   ```

   Cada vez, reemplazando las versiones (la que tenés y la nueva):

   ```bash
   git fetch motor --tags
   git diff v0.2.0 v0.3.0 | git apply --3way
   ```

   Aplica solo lo que cambió entre esas dos versiones y conserva tus cambios.
   Si un archivo tuyo choca, Git lo marca como conflicto para resolverlo a mano.
   Después ejecutá `npm ci` y `npm run check`.

   Con una IA:

   ```text
   Traé a mi copia los cambios del motor entre v0.2.0 y v0.3.0, desde el
   remoto "motor" (docs/OPERACION.md). Conservá mis cambios y mostrame cada
   conflicto antes de resolverlo. Después corré npm ci y npm run check.
   ```

4. Coordiná la pausa con el negocio. Activá modo prueba o apagá el bot desde
   Studio. Lo automático encolado que quede bloqueado se marca fallido con
   motivo de cancelación; los mensajes humanos y avisos internos se conservan.
5. Hacé commit y push a tu copia: Railway despliega. Con token, el arranque
   aplica las migraciones pendientes. Sin token, copiá el SQL del panel,
   pegalo en Supabase y volvé a verificar.
6. Probá login, un mensaje y una derivación antes de habilitar clientes.

Si agregaste migraciones propias, numeralas desde `9001`: las del motor usan
`0001` a `8999` y así una versión nueva no choca con las tuyas.

Cada push a la rama conectada puede disparar un despliegue. Desactivá ese
automatismo si necesitás una ventana de mantenimiento. Una sola réplica también
significa evitar períodos con dos despliegues atendiendo el mismo número.

Volver a un despliegue anterior de Railway **solo revierte el código**. No
revierte SQL ni datos. Si la base cambió, confirmá compatibilidad; normalmente
se corrige con otra migración hacia adelante. Restaurar datos desde un respaldo
es una operación aparte y puede perder lo recibido después de ese respaldo.

## Respaldos

Guardá la base (esquema y datos), las claves en tu gestor y la sesión de WAHA.
No guardes respaldos con datos de clientes en GitHub. El volumen de WAHA no es
el respaldo de Supabase, y tu copia del repo no contiene tus conversaciones.

En Supabase revisá **Database → Backups** según tu plan. Para una exportación
manual seguí la [guía oficial de respaldos](https://supabase.com/docs/guides/platform/backups)
y ensayá la restauración en otro proyecto. El repo no incluye respaldo automático.

## Recuperar acceso al panel

Si hay otro dueño, puede cambiar tu contraseña desde Ajustes → Usuarios.
Si sos el único, usá la administración de Auth de tu proyecto Supabase para
recuperar o cambiar la contraseña de ese usuario. Conservá el mismo email:
el acceso también depende de su fila en `team_members`. No borres la base
ni vuelvas a correr el instalador para recuperar una contraseña.

Un miembro del equipo puede atender y configurar el negocio; crear usuarios,
cambiar contraseñas de otros y aplicar migraciones desde la API requiere dueño.
Los miembros son personas de confianza: no hay aislamiento por agente o cliente.

## Retirar demos anteriores

La demo nueva usa destinos `demo:` y una marca explícita. `demo:limpiar` solo
borra esa versión. Si antes cargaste demos con teléfonos `5989900…`, revisá las
filas y sus mensajes antes de borrar nada: ese prefijo también puede pertenecer
a personas reales. Cancelá cualquier seguimiento ficticio pendiente antes de
vincular un número. No vuelvas a ejecutar el script antiguo de limpieza.

## Pedir ayuda

Compartí: commit del repo, versión de Node/WAHA, si corre local o en Railway,
paso exacto, salida de `npm run doctor` y error recortado. Quitá tokens, claves,
QR y datos de clientes. La plantilla de Issues del repo te guía; no incluye
un compromiso de soporte ni un tiempo de respuesta garantizado.
