import { crearPrisma } from '../src/db/cliente.js';
import { PALABRAS_BASE } from './palabras-base.js';

/**
 * Sincroniza la lista base: deja en la base exactamente las palabras de palabras-base.ts.
 * Se puede correr las veces que haga falta. No toca las palabras propias de cada sala.
 */
async function main() {
  const prisma = crearPrisma();
  try {
    const [, creadas] = await prisma.$transaction([
      prisma.palabra.deleteMany({ where: { salaId: null } }),
      prisma.palabra.createMany({ data: PALABRAS_BASE.map((texto) => ({ texto })) }),
    ]);
    console.log(`Palabras base: ${creadas.count}.`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
