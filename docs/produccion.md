# Producción

Notas para el deploy. El plan general está en `alcance.md`.

## Base de datos en Neon con Prisma

Neon da dos cadenas de conexión, y Prisma necesita las dos:

| Variable | Cadena de Neon | Quién la usa |
| --- | --- | --- |
| `DATABASE_URL` | La **pooled**: host con `-pooler` y `?sslmode=require` | La app en Render, a través de `@prisma/adapter-pg` (`apps/api/src/db/cliente.ts`). Pasa por PgBouncer y no agota las conexiones. |
| `DIRECT_URL` | La **directa**: host sin `-pooler` y `?sslmode=require` | `prisma migrate deploy`, desde `apps/api/prisma.config.ts`. Las migraciones no funcionan a través de PgBouncer. |

Con Prisma 7 (fijado en 7.10.1) ya no existe `directUrl` en `schema.prisma`, y la URL no va en el esquema:

- `prisma.config.ts` define `datasource.url` con `DIRECT_URL`, y la usa solo el CLI: migraciones y seed.
- La app arma el cliente con el adaptador de `pg` y `DATABASE_URL`. No hace falta `pgbouncer=true`, porque ese parámetro era para el motor viejo de Prisma.

En local, con `docker-compose`, no hay pooler: las dos variables apuntan al mismo Postgres.

## Comandos en el deploy

```sh
npm run db:deploy -w @garabato/api   # aplica las migraciones pendientes con DIRECT_URL
npm run db:seed -w @garabato/api     # sincroniza la lista base de palabras
```
