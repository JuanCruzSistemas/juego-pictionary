# Plan de la etapa 1: turnos entre dos celulares

Estado: aprobado el 7 de noviembre de 2026, con los cambios ya incorporados.

Fuentes: `CLAUDE.md`, `docs/alcance.md` y las pantallas de la etapa 1 en `docs/diseno/` (Sistema, Bienvenida, Main, Elegir, Lienzo, Adivinar y Acierto).

## Reglas de la etapa 1

- El juego ofrece 3 palabras al azar, o quien dibuja escribe la suya.
- Los turnos se alternan estrictamente.
- Cada persona tiene 3 salteos, que se renuevan cada media hora.
- Los intentos son ilimitados, y la respuesta tolera tildes, mayúsculas y errores chicos.

Quedan afuera de esta etapa: notificaciones, modo en vivo, pistas, historial y dibujos libres.

## 1. Estructura del monorepo

Uso npm workspaces, sin Nx ni Turborepo, que para dos apps serían de más.

```
garabato/
├── package.json              # workspaces + scripts: dev:api, dev:web, db:up, crear-sala
├── docker-compose.yml        # postgres:17, volumen persistente, puerto 5432
├── .env.example              # DATABASE_URL, PORT, WEB_ORIGIN
├── packages/
│   └── shared/               # solo tipos TS: Stroke, DTOs de la API, estados del turno
├── apps/
│   ├── api/                  # NestJS + Prisma
│   │   ├── prisma/schema.prisma, migrations/, seed.ts (palabras base)
│   │   ├── scripts/crear-sala.ts
│   │   └── src/ health/ salas/ sesion/ turnos/ palabras/ comun/normalizar.ts
│   └── web/                  # Angular standalone + signals
│       └── src/ styles/tokens.css, styles/base.css, app/...
└── docs/
```

- **ORM: Prisma 7.10.1**, con versión fija. Las migraciones son simples y anda igual con Postgres local y con Neon.
- **`packages/shared`** tiene el tipo `Stroke` y los contratos de la API. Así el front y el back no se desfasan. Son solo tipos y no se compila aparte.
- **Para probar en los dos celulares en local:** `ng serve --host 0.0.0.0` con un proxy `/api → localhost:3000`. Los celulares, en el mismo Wi-Fi, solo necesitan la IP de la compu.
- `@angular/pwa` se suma en la etapa 3, que es la de instalación y push.

## 2. Modelo de datos

| Tabla | Campos principales |
| --- | --- |
| **Sala** | `id`, `invitacion` (token aleatorio del link, único), `creadaEn` |
| **Jugador** | `id`, `salaId`, `nombre`, `lugar` (1 o 2, único por sala), `sesionHash` (SHA-256 del token), `creadoEn` |
| **Turno** | `id`, `salaId`, `numero` (único por sala), `dibujaId`, `adivinaId`, `estado`, `opciones` (`text[]`, las 3 palabras ofrecidas), `palabra`, `palabraNormalizada`, `origen` (`sugerida` o `propia`), `creadoEn`, `enviadoEn`, `adivinadoEn` |
| **Dibujo** | `id`, `turnoId` (único, nullable para los dibujos libres de la etapa 2), `autorId`, `trazos` (jsonb `Stroke[]`), `duracionMs`, `creadoEn` |
| **Intento** | `id`, `turnoId`, `jugadorId`, `texto`, `correcto`, `creadoEn` |
| **Salteo** | `id`, `jugadorId`, `turnoId`, `creadoEn` |
| **Palabra** | `id`, `texto`, `salaId` (null = lista base; la etapa 2 suma las propias de cada sala) |

**Estados del turno:** `eligiendo → dibujando → adivinando → adivinado`, o `salteado` desde `eligiendo` o `dibujando`.

- Las 3 opciones se sortean una sola vez, al crear el turno. Si se recarga la página, no cambian.
- Cada cambio de estado y la creación del turno siguiente pasan en una transacción. La restricción única `(salaId, numero)` evita que se dupliquen turnos.
- Los trazos van en un único jsonb por dibujo. Se leen y se escriben siempre juntos, y la etapa 2 los va a reproducir con los `t` que ya trae cada punto.

```ts
type Stroke = {
  color: string;
  width: number;
  points: { x: number; y: number; t: number }[];
};
```

## 3. Endpoints

Todos van con el prefijo `/api`, salvo `/health`. Los que requieren sesión usan `Authorization: Bearer <token>`.

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET | `/health` | Responde sin tocar la base, para el uptime bot. |
| GET | `/salas/:invitacion` | Público. Devuelve si la sala está llena y el nombre de quien ya entró, para el texto "Juan te invitó". |
| POST | `/salas/:invitacion/jugadores` | `{nombre}` → `{token, jugador}`. Da 409 si ya hay dos personas. |
| GET | `/estado` | Devuelve la persona actual, la otra persona, el turno actual con su rol y su estado, la cantidad de intentos y los salteos (cuántos quedan y cuándo vuelve el próximo). A quien dibuja también le trae las opciones. |
| POST | `/turnos/:id/palabra` | `{opcion}` o `{propia}`. Solo quien dibuja, en `eligiendo` o `dibujando`, así puede volver y cambiarla. |
| POST | `/turnos/:id/dibujo` | `{trazos, duracionMs}`. Valida coordenadas entre 0 y 1 y un tamaño máximo, y pasa el turno a `adivinando`. |
| GET | `/turnos/:id/dibujo` | Los trazos, para quien dibujó o quien adivina, una vez enviado. |
| GET | `/turnos/:id/intentos` | La lista de "Ya probaste". |
| POST | `/turnos/:id/intentos` | `{texto}` → `{correcto, intentos}`. Si acierta, cierra el turno y crea el siguiente. |
| POST | `/turnos/:id/salteo` | Solo quien dibuja y antes de enviar. Gasta un salteo y crea el turno siguiente. |
| GET | `/turnos/:id/resumen` | Para la pantalla de Acierto: la palabra, el dibujo y la cantidad de intentos. |

### Comparación de la respuesta

La respuesta se compara solo en el backend. Quien adivina nunca recibe la palabra antes de acertar.

1. Se normalizan los dos textos: NFD, sin tildes, en minúsculas, sin puntuación y con los espacios repetidos juntados.
2. Se calcula la distancia de Damerau-Levenshtein en su variante OSA (inserción, borrado, sustitución o intercambio de dos letras contiguas):
   - hasta 4 letras: solo exacta o un intercambio de dos letras contiguas;
   - de 5 a 7 letras: tolera 1 error;
   - con 8 o más: tolera 2.

Esta función va con tests unitarios desde el primer día, entre ellos:

- "maet" acierta "mate";
- "gato" no acierta "pato";
- "MATÉ" acierta "mate".

### La palabra no se filtra

Ni `/estado` ni `/turnos/:id/resumen` devuelven la palabra a quien adivina antes de que el turno esté `adivinado`. Hay un test que lo comprueba.

## 4. Rutas y componentes de Angular

| Ruta | Componente | Pantalla |
| --- | --- | --- |
| `/s/:invitacion` | `BienvenidaPage` | `Bienvenida.dc.html` |
| `/entrar` | `EntrarPage` | Sin diseño propio: "Abrí tu link para entrar", con el estilo de Bienvenida |
| `/` | `InicioPage` | `Main.dc.html` |
| `/elegir` | `ElegirPage` | `Elegir.dc.html` |
| `/dibujar` | `LienzoPage` | `Lienzo.dc.html` |
| `/adivinar` | `AdivinarPage` | `Adivinar.dc.html` |
| `/acierto/:turnoId` | `AciertoPage` | `Acierto.dc.html` |

### Piezas compartidas

- `LienzoCanvas` captura el dibujo con Pointer Events, ajusta por `devicePixelRatio` y normaliza a 0–1. El canvas lleva `touch-action: none` y la página `overscroll-behavior: none`, para que en Android no scrollee ni recargue al dibujar.
- `DibujoVista` pinta los trazos en modo lectura, para Adivinar y Acierto.
- `trazos.ts` tiene las funciones puras de dibujo sobre Canvas que usan los dos.

### Servicios

- `SesionService` maneja el token en `localStorage`.
- `ApiService` hace las llamadas.
- `EstadoService` guarda el estado del juego en un signal y lo actualiza cada 5 s mientras la pestaña está visible y al volver a ella.

### Guards

- Sin sesión se muestra un "abrí tu link".
- Si el rol no corresponde a la ruta, se vuelve al inicio.

### Sistema visual

- `tokens.css` tiene las variables `--birome`, `--resaltador`, `--correccion`, `--texto-suave`, `--hoja`, `--cuadricula` y las de fuentes, con los valores de `Sistema.dc.html`.
- `base.css` tiene clases globales: `.hoja` (fondo cuadriculado de 24 px), `.btn-principal` (con el borde irregular y la sombra dura), `.btn-secundario`, `.campo`, `.tarjeta` y `.etiqueta`.
- Las fuentes, Shantell Sans y Figtree, se cargan de Google Fonts.

### Qué se oculta en la etapa 1

Son funciones de etapas siguientes:

- La racha, el dibujo libre, el modo en vivo y los últimos dibujos en Main.
- "Ver nuestras palabras" en Elegir.
- La reproducción y las pistas en Adivinar: se muestra el dibujo terminado.
- La racha, las pistas y "Ver historial" en Acierto.
- "Activar avisos" en Bienvenida: queda un solo botón, "Entrar".

## 5. Acceso por link y sesión

1. La sala se crea con `npm run crear-sala`, que imprime el link `https://…/s/<invitacion>`. El token es aleatorio, de 32 bytes en base64url. No hace falta una pantalla para crear salas.
2. Cada persona abre el link, pone su nombre y la API le da un token de sesión aleatorio. En la base solo queda el hash.
3. El token se guarda en `localStorage` y se manda como Bearer. Se usa Bearer y no cookie porque en producción el front y la API van a estar en dominios distintos de Render, y ahí las cookies de terceros dan problemas.
4. Cuando entran dos personas, la sala se cierra. Si alguien abre el link de nuevo y ya tiene sesión, entra directo.
5. **Límite conocido:** si alguien borra los datos del navegador, pierde su lugar. Se resuelve con un script `liberar-lugar` en vez de un flujo de recuperación, para no abrir un agujero si el link se filtra. Pendiente: borrar al jugador también borraría sus turnos, así que el script tiene que reasignar el lugar sin perder la historia.

## 6. Orden de construcción

Cada paso queda andando y se puede probar.

1. **Esqueleto.** Monorepo, docker-compose, Nest con `/health` y Angular con los tokens, las fuentes y las clases base.
   Prueba: abrir la página en el celular por la red local y ver la hoja cuadriculada con un botón principal.
2. **Base.** Esquema de Prisma, migración, seed de palabras base y `crear-sala`.
   Prueba: el script imprime un link y la sala aparece en la base.
3. **Sesión y Bienvenida.** Los endpoints de sala y jugadores, la pantalla, `SesionService` y el guard.
   Prueba: entran dos navegadores, el tercero queda rechazado y al recargar la sesión sigue.
4. **Estado e Inicio.** `/estado`, el primer turno y las tarjetas de Main según el rol, con polling.
   Prueba: un celular ve "Te toca dibujar" y el otro, el estado de espera.
5. **Elegir.** Las opciones, la palabra propia y el salteo con su contador.
   Prueba: saltear pasa el turno al otro celular y el contador baja.
6. **Lienzo local.** Dibujo con colores, grosores, deshacer, goma y borrar todo, sin backend.
   Prueba: dibujar con el dedo en el celular.
7. **Mandar el dibujo.** El endpoint y `DibujoVista`.
   Prueba: el otro celular pasa a "Te toca adivinar" y ve el dibujo igual que como se hizo.
8. **Adivinar.** Los intentos, "Ya probaste" y la comparación con sus tests, más el test de que la palabra no se filtra.
   Prueba: "MATÉ", "maet" y "mate" aciertan "mate", y "gato" no acierta "pato".
9. **Acierto y turno siguiente.**
   Prueba: una partida completa de varios turnos entre los dos celulares, con los roles alternándose.
10. **Pulido.** Errores de red, botones deshabilitados mientras se envía y un borrador del dibujo en `localStorage` para no perderlo si se cierra la app.

## 7. Decisiones tomadas

- [x] **Renovación de los salteos.** Cada salteo vuelve 30 minutos después de usado: se cuentan los de la última media hora.
- [x] **Qué hace saltear.** El turno de dibujar pasa a la otra persona. Es la única excepción a la alternancia.
- [x] **Estados de Main que no están en los diseños.** "Ella está dibujando", para cuando te toca adivinar y la otra persona todavía no mandó el dibujo, y "Esperando que entre", con el link para compartir. Usan la misma tarjeta con otro texto. "Ella está adivinando" va sin el botón de pistas, que es de la etapa 2.
- [x] **Lienzo cuadrado (1:1).** Para que las coordenadas de 0 a 1 no se deformen entre pantallas. El grosor se guarda relativo al lado del lienzo y la goma, como un trazo del color de la hoja.

## 8. Producción

Ver `docs/produccion.md`: con Neon, Prisma necesita `DATABASE_URL` con pooling y `DIRECT_URL` para las migraciones.
