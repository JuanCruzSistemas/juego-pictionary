import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { crearPrisma } from '../db/cliente.js';
import { apuntaALocalhost } from './es-local.js';

/**
 * Borra todas las salas y, en cascada, sus jugadores, turnos, dibujos, intentos y salteos.
 * No toca la lista base de palabras. Solo corre contra un Postgres local y pide confirmación.
 * Uso: npm run db:limpiar-salas
 */
if (existsSync('.env')) process.loadEnvFile('.env');

const CONFIRMACION = 'BORRAR';

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!apuntaALocalhost(url)) {
    console.error('No se borró nada: DATABASE_URL no apunta a localhost.');
    console.error('Este script es solo para la base local de desarrollo.');
    return 1;
  }
  if (!process.stdin.isTTY) {
    console.error('No se borró nada: el script necesita una terminal para pedir confirmación.');
    return 1;
  }

  const prisma = crearPrisma();
  try {
    const [salas, jugadores, turnos, palabras] = await Promise.all([
      prisma.sala.count(),
      prisma.jugador.count(),
      prisma.turno.count(),
      prisma.palabra.count({ where: { salaId: null } }),
    ]);
    console.log(`Base: ${new URL(url!).host}${new URL(url!).pathname}`);
    console.log(`Se van a borrar ${salas} salas, ${jugadores} jugadores y ${turnos} turnos, con sus dibujos, intentos y salteos.`);
    console.log(`Las ${palabras} palabras base quedan.`);

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const respuesta = await rl.question(`Escribí ${CONFIRMACION} para confirmar: `);
    rl.close();
    if (respuesta.trim() !== CONFIRMACION) {
      console.log('Cancelado. No se borró nada.');
      return 1;
    }

    const borradas = await prisma.sala.deleteMany();
    const quedan = await prisma.palabra.count({ where: { salaId: null } });
    console.log(`Listo: ${borradas.count} salas borradas. Palabras base: ${quedan}.`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
