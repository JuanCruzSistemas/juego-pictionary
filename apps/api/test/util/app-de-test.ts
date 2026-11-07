import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configurarApp } from '../../src/configurar.js';
import { PrismaService } from '../../src/db/prisma.service.js';

export type AppDeTest = { app: INestApplication<App>; prisma: PrismaService };

export async function crearAppDeTest(): Promise<AppDeTest> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication<INestApplication<App>>();
  configurarApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/**
 * Borra las salas y, por ON DELETE CASCADE, lo que cuelga de ellas. Deja las palabras base.
 * No usa TRUNCATE ... CASCADE porque vaciaría toda la tabla palabras, que referencia a salas.
 */
export async function limpiar(prisma: PrismaService): Promise<void> {
  await prisma.sala.deleteMany();
}
