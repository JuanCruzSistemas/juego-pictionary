import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no carga .env por su cuenta. En producción las variables vienen del entorno.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Las migraciones van por la conexión directa: no funcionan a través de PgBouncer.
  // La app usa DATABASE_URL (con pooling en Neon) desde src/db/cliente.ts.
  datasource: {
    url: process.env.DIRECT_URL ?? '',
  },
});
