import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Crea el cliente de Prisma con el adaptador de pg.
 * Usa DATABASE_URL: en Neon es la cadena con pooling.
 */
export function crearPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL. Copiá .env.example a apps/api/.env.');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
