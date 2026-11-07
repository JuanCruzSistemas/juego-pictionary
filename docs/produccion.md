# Producción

Notas para el deploy. El plan general está en `alcance.md`.

## Base de datos en Neon con Prisma

Neon da dos cadenas de conexión, y Prisma necesita las dos:

| Variable | Cadena de Neon | Para qué |
| --- | --- | --- |
| `DATABASE_URL` | La **pooled**: host con `-pooler` y `?sslmode=require&pgbouncer=true` | Las consultas de la app en Render. Pasa por PgBouncer y no agota las conexiones. |
| `DIRECT_URL` | La **directa**: host sin `-pooler` y `?sslmode=require` | `prisma migrate deploy`. Las migraciones no funcionan a través de PgBouncer. |

En `schema.prisma`, o en `prisma.config.ts` según la versión de Prisma, la fuente de datos tiene que usar `DATABASE_URL` para la app y `DIRECT_URL` para las migraciones.

En local, con `docker-compose`, no hay pooler: las dos variables apuntan al mismo Postgres.
