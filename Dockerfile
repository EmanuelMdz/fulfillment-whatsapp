# Imagen del motor. Un solo proceso sirve el panel, recibe el webhook,
# vacía la cola y contesta los turnos (ver apps/bot/src/index.ts), así que
# de acá sale UN contenedor, no cuatro.
#
# Dos etapas: la primera compila, la segunda solo corre. Así la imagen que
# queda en el servidor no carga con TypeScript, Vite ni las dependencias
# de desarrollo.

# ── Etapa 1: compilar ─────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

# Primero los manifiestos y el lock, solos. Mientras no cambien, Docker
# reutiliza la capa de `npm ci` y una actualización de código compila en
# segundos en vez de bajar todo de nuevo.
COPY package.json package-lock.json ./
COPY apps/bot/package.json apps/bot/
COPY apps/panel/package.json apps/panel/
COPY packages/core/package.json packages/core/
RUN npm ci

COPY . .

# Compila el panel (Vite lo deja en apps/bot/public) y después el servidor
# (tsc lo deja en apps/bot/dist). El panel no hornea ninguna clave: la
# config pública la sirve el servidor en /config.js, y por eso esta misma
# imagen sirve para cualquier instalación.
RUN npm run build

# Fuera lo de desarrollo: el compilador no viaja a producción.
RUN npm prune --omit=dev

# ── Etapa 2: correr ───────────────────────────────────────────
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

# Solo lo que el proceso necesita, con la misma forma de carpetas que el
# repo (el código calcula rutas contra sí mismo, no contra el directorio
# de trabajo):
#   node_modules     dependencias, incluido el enlace a packages/core
#   apps/bot/dist    el servidor compilado
#   apps/bot/public  el panel compilado
#   packages         @fw/core y los .sql de las migraciones, que el
#                    servidor lee del disco al arrancar (db/migrate.ts)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/bot/package.json ./apps/bot/package.json
COPY --from=build /app/apps/bot/dist ./apps/bot/dist
COPY --from=build /app/apps/bot/public ./apps/bot/public
COPY --from=build /app/packages ./packages

# Sin privilegios: la imagen de Node ya trae el usuario `node`. El bot no
# escribe nada en disco (todo va a Supabase), así que no necesita más.
USER node

EXPOSE 3000
CMD ["node", "apps/bot/dist/index.js"]
