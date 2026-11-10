# Plan de la etapa 3: notificaciones e instalación

Estado: aprobado el 10 de noviembre de 2026. Se hace antes que la etapa 2.

## 0. Forma de trabajo

- Todo va en la rama `feature/notificaciones`, con un commit por paso. A `main` solo se pasa con aprobación, porque cada push a `main` despliega en Render.
- Migraciones solo aditivas: agregar tablas o columnas, nunca borrar ni renombrar. Antes de commitear una migración se revisa que su SQL no tenga `DROP` ni `RENAME`.
- Sin claves VAPID, la API arranca igual, con los avisos apagados y un aviso en el log. Un deploy con una variable olvidada no rompe el juego.

## 1. PWA

### `@angular/pwa`

Con versión exacta, igual a `@angular/core` (22.2.5). Agrega el service worker, `ngsw-config.json` y el manifest.

### Manifest

| Campo | Valor |
| --- | --- |
| `name` / `short_name` | Garabato |
| `description` | Pictionary a distancia para dos |
| `lang` | es |
| `start_url` / `scope` | `/` |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `theme_color` | `#FFFFFF` (hoja) |
| `background_color` | `#FFFFFF` |

### Íconos

Una "G" en Shantell Sans 800, birome (`#1B2A7A`), sobre resaltador (`#FFE74C`), como la insignia de `Avisos.dc.html`.

- **Normal (192 y 512 px):** círculo resaltador con borde birome.
- **Maskable (192 y 512 px):** fondo resaltador completo, con la G dentro del 60 % central.
- **Monocromo (96 px):** G blanca sobre transparente, para la barra de notificaciones de Android.
- `apple-touch-icon` de 180 px y favicon.
- Se generan desde un SVG fuente con un script que los renderiza con la fuente real. Los PNG se commitean.

### Service worker (`ngsw-config.json`)

- La app (`index.html`, JS y CSS) se descarga al instalar: abre al instante aunque la API esté despertando.
- Las fuentes de Google se guardan la primera vez que se usan.
- La API nunca se guarda: no hay `dataGroups` que apunten a `garabato-api`. El estado del juego siempre viene de la red.

### Versión nueva

- `SwUpdate` busca actualizaciones al abrir, cada vez que la app vuelve a estar visible y cada 30 minutos.
- Con `VERSION_READY` aparece un aviso fijo abajo: **"Hay una versión nueva · Actualizar"**. "Actualizar" activa la versión nueva y recarga. Nunca recarga sola.
- Mientras tanto, la versión vieja sigue completa desde la caché del service worker: un deploy no deja la app en blanco.
- Si la caché queda rota (`unrecoverable`), recarga con un mensaje.
- Plan de rescate en los docs: si un service worker roto llegara a producción, se publica el `safety-worker.js` de Angular.
- El `Cache-Control: no-cache` del sitio estático también cubre `ngsw.json` y `ngsw-worker.js`.

### Instalación

Tarjeta en Inicio, con `beforeinstallprompt`: **"Instalá Garabato en tu celu · Instalar · Ahora no"**.

- "Ahora no" la oculta en ese dispositivo (`localStorage`), igual que la de avisos.
- No aparece si la app ya está instalada (`display-mode: standalone`, o el evento `appinstalled`), ni si el navegador no ofrece `beforeinstallprompt`.
- Si están las dos tarjetas, va primero la de avisos.

## 2. Push en la API

### Claves VAPID

- Un par generado con `web-push generate-vapid-keys`.
- En `render.yaml`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`, las tres con `sync: false`. `VAPID_SUBJECT` es `mailto:` con el mail del dueño y va solo en Render.
- La web pide la clave pública a la API (`GET /api/push/clave`): cambiarla no requiere rebuild.

### Migración aditiva: `suscripciones_push`

| Campo | Notas |
| --- | --- |
| `id` | uuid |
| `jugadorId` | FK a jugadores, se borra con el jugador |
| `endpoint` | único: identifica dispositivo y navegador |
| `p256dh`, `auth` | claves del navegador para cifrar |
| `creadaEn`, `actualizadaEn` | |

Varios dispositivos por jugador. Si un dispositivo cambia de sala, la suscripción con su endpoint pasa al jugador nuevo.

### Endpoints

- `GET /api/push/clave` (público): la clave pública, o `null` si los avisos están apagados.
- `POST /api/push/suscripciones` (con sesión): guarda o actualiza. Validación con Zod: endpoint `https`, claves en base64url y tamaños máximos.
- `DELETE /api/push/suscripciones` (con sesión): cuando el dispositivo deja la sala.

### Envío

- `NotificacionesService`, detrás de una interfaz `EnviadorPush`: `web-push` (versión exacta) en producción y uno falso en los tests.
- Después del commit de la transacción, sin bloquear la respuesta. Si falla, solo queda en el log: el juego sigue igual.
- A todas las suscripciones del jugador en paralelo, con un tiempo máximo de 10 s.
- **404 o 410:** la suscripción se borra. Otros errores: se registran y la suscripción queda.
- TTL de 24 h, `tag` por sala y `topic` de push para que solo quede el último aviso de la partida.

## 3. Los avisos

Con el nombre real de la otra persona.

| Cuándo | A quién | Título | Texto | Al tocar abre |
| --- | --- | --- | --- | --- |
| El otro manda el dibujo | Quien adivina | Te dibujaron algo | [nombre] terminó su dibujo. Te toca adivinar. | `/adivinar` |
| Aciertan tu dibujo | Quien dibujó | Adivinó tu dibujo | Era [palabra]. Ahora te toca adivinar a vos. | `/acierto/:turnoId` |
| El otro saltea | Quien pasa a dibujar | Te toca dibujar | [nombre] te pasó el turno. Elegí qué dibujar. | `/elegir` |

- "Te dibujaron algo" solo sale cuando el dibujo se guarda de verdad: un reintento del mismo envío no repite el aviso.
- La palabra solo va en el aviso de quien la dibujó. El payload va cifrado de punta a punta.
- El payload trae `onActionClick` con `navigateLastFocusedOrOpen`. Si la pantalla ya no corresponde, las redirecciones de cada página llevan a Inicio.

## 4. El permiso en la web

### Bienvenida

"Activar avisos y entrar" (principal) y "Entrar sin avisos" (enlace), como en el diseño.

- El permiso se pide primero, dentro del toque; después entra a la sala y, si se concedió, suscribe.
- Si el service worker todavía no está listo, la suscripción queda pendiente y se completa al abrir Inicio.

### Tarjeta de avisos en Inicio

"Activá los avisos · Te avisamos cuando [nombre] te dibuje algo o adivine tu dibujo", con "Activar avisos" y "Ahora no". Estilo de tarjeta punteada, como "Ella te dejó un dibujito" en Main.

| Estado | Qué pasa |
| --- | --- |
| Permiso sin decidir y nunca "Ahora no" | Se muestra |
| "Ahora no" | No vuelve a aparecer en ese dispositivo |
| Rechazado | Nunca se muestra |
| Concedido | Sin tarjeta; en cada apertura se confirma la suscripción con la API, sin preguntar |
| Navegador sin push | Nada |

## 5. Tests

- **API, unitarios:** textos y payload de cada aviso, borrado por 404 y 410, y que otros errores no borren.
- **API, e2e con el enviador falso:** cada evento avisa a quien corresponde y una sola vez; el reintento de un dibujo no avisa de nuevo; si el enviador falla o tarda, el endpoint del juego responde 200 y el turno avanza; la suscripción queda con el jugador correcto.
- **Web:** cuándo mostrar cada tarjeta y en qué orden, y el aviso de versión nueva con `SwUpdate` simulado.

## 6. Pruebas con HTTPS

Solo cloudflared, sin staging en Render ni rama de Neon.

- Build de producción de la web servido localmente junto con la API, en un mismo origen, y `cloudflared tunnel --url …` da una URL `https://….trycloudflare.com` para el celular.
- La URL cambia en cada corrida: hay que volver a suscribirse.
- **Aviso de versión nueva:** dos builds seguidos por el mismo túnel, sin cerrar la app en el celular.

## 7. Orden de construcción

1. PWA base: `@angular/pwa`, manifest, íconos y `ngsw-config.json`. Prueba: app instalable por cloudflared.
2. Aviso de versión nueva (`SwUpdate`) y tarjeta de instalación, con tests. Prueba: dos builds por el túnel.
3. Migración `suscripciones_push` y endpoints de clave y suscripción, con e2e.
4. Envío: `EnviadorPush`, `web-push`, los tres disparadores, borrado por 404/410 y aislamiento de errores, con e2e.
5. Web: Bienvenida con avisos, tarjeta de avisos en Inicio, suscripción silenciosa y navegación al tocar el aviso.
6. Prueba en los dos celulares por cloudflared.
7. `docs/produccion.md`, `render.yaml` y paso a `main` con aprobación. Antes del merge, las claves VAPID de producción se cargan en Render.
