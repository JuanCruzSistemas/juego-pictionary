import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** Opciones del cliente: adaptador de pg con DATABASE_URL, que en Neon es la cadena con pooling. */
export function opcionesPrisma(): ConstructorParameters<typeof PrismaClient>[0] {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta DATABASE_URL. Copiá .env.example a apps/api/.env.');
  }
  return { adapter: new PrismaPg({ connectionString }) };
}

/** Cliente suelto para los scripts. Dentro de Nest se usa PrismaService. */
export function crearPrisma(): PrismaClient {
  return new PrismaClient(opcionesPrisma());
}
