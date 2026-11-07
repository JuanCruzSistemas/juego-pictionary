import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { crearPrisma } from '../db/cliente.js';

/**
 * Crea una sala y muestra el link de invitación.
 * Uso: npm run crear-sala [-- --url http://192.168.0.10:4200]
 */
if (existsSync('.env')) process.loadEnvFile('.env');

function baseWeb(): string {
  const i = process.argv.indexOf('--url');
  const url = i >= 0 ? process.argv[i + 1] : process.env.WEB_URL;
  return (url ?? 'http://localhost:4200').replace(/\/+$/, '');
}

async function main() {
  const prisma = crearPrisma();
  try {
    const invitacion = randomBytes(32).toString('base64url');
    await prisma.sala.create({ data: { invitacion } });
    console.log('Sala creada. Mandale este link a cada persona:');
    console.log(`${baseWeb()}/s/${invitacion}`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
