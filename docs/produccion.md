# Producción

Deploy de la etapa 1: API en Render como servicio web, web en Render como sitio estático y base en Neon. Toda la configuración de Render está en `render.yaml` (Blueprint).

## Arquitectura

| Pieza | Dónde | Nombre | URL |
| --- | --- | --- | --- |
| API NestJS | Render, servicio web gratis, Ohio | `garabato-api` | `https://garabato-api.onrender.com` |
| Web Angular | Render, sitio estático | `garabato` | `https://garabato-alw3.onrender.com` |
| PostgreSQL | Neon, plan gratis, AWS us-east-2 (Ohio) | `garabato` | — |
| Uptime bot | UptimeRobot, cada 5 minutos | — | `GET /health` de la API |

El nombre `garabato` ya estaba tomado en Render, que le agregó el sufijo `-alw3` a la web. Por eso `WEB_ORIGIN` es `https://garabato-alw3.onrender.com`. La API sí quedó como `garabato-api`, así que `API_BASE` no cambió. Si alguna URL cambia, ver «Si una URL no es la esperada».

## Variables de entorno

| Variable | Servicio | Valor | En `render.yaml` |
| --- | --- | --- | --- |
| `DATABASE_URL` | `garabato-api` | Neon, cadena **con pooling** (host con `-pooler`) | `sync: false` |
| `DIRECT_URL` | `garabato-api` | Neon, cadena **directa** (host sin `-pooler`) | `sync: false` |
| `WEB_ORIGIN` | `garabato-api` | URL del sitio estático, sin barra final | `sync: false` |
| `VAPID_PUBLIC_KEY` | `garabato-api` | Clave VAPID pública de producción | `sync: false` |
| `VAPID_PRIVATE_KEY` | `garabato-api` | Clave VAPID privada de producción: secreta | `sync: false` |
| `VAPID_SUBJECT` | `garabato-api` | `mailto:` con el mail de contacto | `sync: false` |
| `API_BASE` | `garabato` (en el build) | URL de la API, sin barra final ni `/api` | valor fijo, editable en el panel |
| `PORT` | `garabato-api` | La pone Render | no se define |

`sync: false` quiere decir que el valor no está en el repo: Render lo pide al crear el Blueprint y queda guardado en el panel.

No hay que definir `NODE_ENV=production` en el build: `npm ci` tiene que instalar las devDependencies, porque `prisma migrate deploy` corre al iniciar.

## Cómo está armado

### Node

`.node-version` fija **24.22.2** (LTS) para los dos servicios, y `engines` en `package.json` pide 24 o más. La suite completa pasa con Node 24.22.2 y npm 11.19.1, con `npm ci` desde cero. En desarrollo se puede seguir usando Node 26.

### Base de datos: Neon con Prisma 7

Prisma 7 (fijado en 7.10.1) ya no usa `url` ni `directUrl` en `schema.prisma`:

- `apps/api/prisma.config.ts` define `datasource.url` con `DIRECT_URL`. La usa solo el CLI (migraciones y seed), porque las migraciones no funcionan a través de PgBouncer.
- La app arma el cliente con `@prisma/adapter-pg` y `DATABASE_URL`, la cadena con pooling (`apps/api/src/db/cliente.ts`). No hace falta `pgbouncer=true`: ese parámetro era para el motor viejo de Prisma.

En local, con `docker-compose`, no hay pooler: las dos variables apuntan al mismo Postgres.

### Migraciones y seed

- **Migraciones:** el comando de inicio de la API corre `prisma migrate deploy` antes de levantar Nest. El plan gratis de Render no tiene comando previo al deploy. Con una sola instancia es seguro, y sin migraciones pendientes no hace nada.
- **Seed:** se corre a mano desde una compu, solo la primera vez o cuando cambie la lista de palabras (`apps/api/prisma/palabras-base.ts`). Es idempotente: deja en la base exactamente esa lista y no toca las salas.

### CORS y API_BASE

- La web llama a la API en `${API_BASE}/api/...`. `apps/web/scripts/escribir-api-base.mjs` escribe `src/app/api/api-base.ts` antes de cada build con la variable `API_BASE`:
  - en desarrollo queda vacía y la web usa el proxy de `ng serve`;
  - en Render (que define `RENDER`) es obligatoria, y el build falla si falta o si no es un origen sin ruta.
- La API habilita CORS solo para `WEB_ORIGIN` (`apps/api/src/configurar.ts`), con `maxAge` de 600 s para que el navegador recuerde la consulta previa que dispara el header `Authorization`. Sin `WEB_ORIGIN` válido no habilita CORS para nadie, y en Render lo avisa en el log al arrancar.

### Sitio estático

- Reescritura `/*` → `/index.html`, para que `/s/...`, `/elegir`, `/dibujar`, etc. funcionen al recargar.
- `Cache-Control: no-cache` en todo: el navegador revalida con ETag. Sin esto, después de un deploy un `index.html` viejo en caché pediría archivos `.js` que ya no existen y la app quedaría en blanco.

### PWA y service worker (etapa 3)

- La app se instala (manifest con orientación vertical) y el service worker guarda la app y las fuentes, nunca la API.
- Cuando hay un deploy nuevo de la web, la app muestra **"Hay una versión nueva · Actualizar"**. No recarga sola: mientras tanto sigue la versión anterior, completa desde la caché.
- `Cache-Control: no-cache` del sitio estático también cubre `ngsw.json` y `ngsw-worker.js`, así el service worker ve cada versión nueva.
- **Plan de rescate:** si alguna vez llegara a producción un service worker roto, publicar el `safety-worker.js` de Angular en lugar de `ngsw-worker.js` (copiarlo de `node_modules/@angular/service-worker/safety-worker.js` al build). Desregistra el service worker en los dispositivos y la app vuelve a cargar de la red.

### Avisos push (etapa 3)

- Par VAPID **propio de producción**, distinto del local. Se genera con `npx web-push generate-vapid-keys` y se carga solo en el panel de Render: nunca en el repo ni en archivos.
- `VAPID_SUBJECT` es `mailto:` con el mail de contacto: los servicios de push lo usan si necesitan avisar algo.
- La web pide la clave pública a `GET /api/push/clave`. Si faltan claves, devuelve `null`, la web no ofrece avisos y el juego anda igual.
- **Cambiar las claves:** invalida las suscripciones existentes. Cada dispositivo se vuelve a suscribir solo la próxima vez que abre la app, sin preguntar nada, porque el permiso ya estaba dado. Hasta entonces no le llegan avisos.
- Si un servicio de push responde 404 o 410, la suscripción se borra sola. Otros errores quedan en el log de `garabato-api` como `[Avisos]`.

### Builds

Cada servicio tiene un `buildFilter`: un cambio solo en la web no redeploya la API, y al revés.

## Primer deploy, paso a paso

### 1. Neon

1. En [console.neon.tech](https://console.neon.tech), **New project**:
   - **Name:** `garabato`
   - **Postgres version:** la que ofrezca por defecto
   - **Cloud provider / Region:** AWS, **US East 2 (Ohio)**
2. En el proyecto, **Connect**. Dejá la rama, la base (`neondb`) y el rol que vienen por defecto.
3. Con **Connection pooling activado**, copiá la cadena: es `DATABASE_URL`. El host termina en `-pooler.us-east-2.aws.neon.tech`.
4. Con **Connection pooling desactivado**, copiá la cadena: es `DIRECT_URL`. Mismo host, sin `-pooler`.

Las dos traen `?sslmode=require` y quizás `&channel_binding=require`: dejalas tal cual.

### 2. En tu compu: migrar y cargar las palabras

Creá `apps/api/.env.produccion`. Ya está ignorado por git (`.env.*`):

```sh
DATABASE_URL=postgresql://...-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require...
DIRECT_URL=postgresql://....us-east-2.aws.neon.tech/neondb?sslmode=require...
```

Y corré, desde la raíz del repo:

```sh
cd apps/api
env $(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.produccion | xargs) npx prisma migrate deploy   # DIRECT_URL: aplica 1 migración
env $(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.produccion | xargs) npm run db:seed             # DATABASE_URL: "Palabras base: 130."
cd ../..
```

Esto prueba las dos cadenas antes de tocar Render. Las variables pasadas así tienen prioridad sobre `apps/api/.env`.

**No uses `set -a && . ./.env.produccion`:** las cadenas de Neon traen `&channel_binding=require` sin comillas, y al cargarlas así la shell toma el `&` como «mandar al fondo» y corta la cadena. `env $(…)` no lo interpreta.

`pg` avisa que `sslmode=require` se trata como `verify-full`, la verificación completa del certificado. Hoy es lo que pasa y está bien. Para que no avise, se puede cambiar a `sslmode=verify-full` en las dos cadenas, en `.env.produccion` y en Render.

### 3. Render: Blueprint

1. En [dashboard.render.com](https://dashboard.render.com), **New → Blueprint**.
2. Conectá GitHub y dale acceso al repo `JuanCruzSistemas/juego-pictionary`. Elegí la rama `main`.
3. Render lee `render.yaml` y muestra dos servicios, `garabato-api` y `garabato`. Te pide los valores `sync: false`:
   - `DATABASE_URL`: la cadena con pooling;
   - `DIRECT_URL`: la cadena directa;
   - `WEB_ORIGIN`: `https://garabato-alw3.onrender.com`. En el primer deploy se puso `https://garabato.onrender.com` y después se corrigió en el panel, cuando Render mostró la URL con sufijo.
4. **Apply**. El primer build de cada servicio tarda unos minutos.

### 4. Comprobar las URL

1. En el panel de cada servicio, mirá la URL que le dio Render.
2. Tienen que ser `https://garabato-api.onrender.com` y `https://garabato-alw3.onrender.com`. Si no, seguí «Si una URL no es la esperada».
3. Abrí `https://garabato-api.onrender.com/health`: tiene que responder `{"ok":true}`.
4. Abrí `https://garabato-alw3.onrender.com`: tiene que mostrar «Abrí tu link para entrar».
5. Comprobá el CORS desde la URL de la web. La respuesta tiene que traer `access-control-allow-origin: https://garabato-alw3.onrender.com` y `access-control-max-age: 600`:

   ```sh
   curl -s -o /dev/null -D - -X OPTIONS https://garabato-api.onrender.com/api/estado \
     -H "Origin: https://garabato-alw3.onrender.com" \
     -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization"
   ```

### 5. Crear la sala de producción

```sh
cd apps/api
env $(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.produccion | xargs) npm run crear-sala -- --url https://garabato-alw3.onrender.com
cd ../..
```

Imprime `https://garabato-alw3.onrender.com/s/<invitacion>`. Mandá ese link a cada persona por un canal privado: mientras quede un lugar, cualquiera con el link puede entrar. `npm run db:limpiar-salas` se niega a correr contra Neon a propósito.

### 6. UptimeRobot

En [uptimerobot.com](https://uptimerobot.com), **Add New Monitor**:

- **Monitor type:** HTTP(s)
- **URL:** `https://garabato-api.onrender.com/health`
- **Monitoring interval:** 5 minutos

Así la API no se duerme a los 15 minutos sin tráfico. Un solo servicio encendido todo el mes (unas 744 h) entra en las 750 h gratis de Render. `/health` no consulta la base: Neon se suspende sin uso, y la primera consulta tarda alrededor de un segundo más.

### 7. Avisos push

En `garabato-api` → **Environment**, cargar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`, y guardar con deploy. Comprobar que `https://garabato-api.onrender.com/api/push/clave` devuelva la clave pública.

### 8. Prueba final

- Una partida completa con los dos celulares, por HTTPS. Ahora «Compartir link» y «Copiar link» funcionan.
- En los logs de `garabato-api`: sin errores 500 ni avisos de `WEB_ORIGIN`.

## Si una URL no es la esperada

- **La API quedó en otra URL:** en el servicio `garabato` → **Environment**, cambiá `API_BASE` y hacé **Manual Deploy**, porque la variable se usa en el build. Para que quede en el repo, cambiala también en `render.yaml`. Actualizá el monitor de UptimeRobot.
- **La web quedó en otra URL:** en el servicio `garabato-api` → **Environment**, cambiá `WEB_ORIGIN` y guardá con deploy. Usá esa URL en `crear-sala --url`.

## Problemas comunes

| Síntoma | Causa probable |
| --- | --- |
| La web muestra «Despertando el servidor…» un rato largo | La API estaba dormida (sin UptimeRobot) o arrancando después de un deploy. Tarda hasta un minuto. |
| En la consola del navegador: «blocked by CORS policy» | `WEB_ORIGIN` no coincide con la URL de la web (barra final, http/https, sufijo de Render). |
| Las llamadas van a `https://garabato-alw3.onrender.com/api/...` y dan 404 | El build de la web no tenía `API_BASE`: no debería pasar, porque en Render el build falla. |
| `prisma migrate deploy` falla en el inicio | `DIRECT_URL` tiene la cadena con pooling, o falta. |
| Error de conexión de `pg` con `channel_binding` | Probar la cadena sin `&channel_binding=require`, primero en el paso 2. |

## Probar por HTTPS antes de pasar a `main`

Push y la instalación necesitan HTTPS. En local:

```sh
npm run dev:api                          # con claves VAPID locales en apps/api/.env
npm run build -w @garabato/web
npm run servir-build -w @garabato/web    # sirve el build como Render, con /api a la API local
cloudflared tunnel --url http://localhost:4300
```

La URL `https://….trycloudflare.com` cambia en cada corrida: hay que volver a suscribirse. Para ver el aviso de versión nueva, hacer otro build con algún cambio sin cerrar la app.

## Modo en vivo (Socket.IO)

- La API atiende Socket.IO en `/socket.io`, en el mismo servicio `garabato-api`. Render soporta WebSockets en los servicios web, sin configurar nada.
- El CORS del socket es el mismo de la API: solo `WEB_ORIGIN`. Si la web cambia de URL, cambia para los dos.
- Las partidas en vivo viven en la memoria de la API (hay una sola instancia). Si Render reinicia el servicio, las partidas terminan y los turnos siguen por turnos; si las dos personas vuelven a la pantalla en vivo, se arma sola.
- En local, `ng serve` pasa `/socket.io` a la API (proxy con `ws: true`).
- Sin migraciones.

## Mantenimiento

- **Cambiar la lista de palabras:** editar `palabras-base.ts`, commit y push, y correr `npm run db:seed` con `.env.produccion` como en el paso 2.
- **Secretos:** solo en `apps/api/.env.produccion` y en el panel de Render. Git ignora cualquier archivo con `.env` en el nombre, pero no un `.md` o `.txt` suelto: antes de cada commit, revisar `git status` con los archivos sin trackear.
- **Nueva migración:** `npm run db:migrate` en local, commit y push. Render la aplica al iniciar la API.
- **Logs:** panel de Render → `garabato-api` → **Logs**.
