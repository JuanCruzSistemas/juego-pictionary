import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configurarApp } from '../../src/configurar.js';
import { PrismaService } from '../../src/db/prisma.service.js';
import { Reloj } from '../../src/comun/reloj.js';
import { ConfigPush } from '../../src/push/config.js';

/** Reloj que solo avanza cuando el test lo pide. */
export class RelojDeTest extends Reloj {
  static readonly INICIO = new Date('2026-11-07T13:00:00.000Z');
  private actual = RelojDeTest.INICIO;
  /** Vuelve a las 13:00 UTC del 7/11/2026. */
  reiniciar(): void {
    this.actual = RelojDeTest.INICIO;
  }
  ahora(): Date {
    return new Date(this.actual);
  }
  avanzarMinutos(n: number): void {
    this.actual = new Date(this.actual.getTime() + n * 60 * 1000);
  }
}

export type AppDeTest = { app: INestApplication<App>; prisma: PrismaService; reloj: RelojDeTest };

/** Claves VAPID de prueba: sin ellas, los avisos quedan apagados. */
export type OpcionesDeTest = { push?: Partial<ConfigPush> };

export async function crearAppDeTest(opciones: OpcionesDeTest = {}): Promise<AppDeTest> {
  const reloj = new RelojDeTest();
  let constructor = Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Reloj).useValue(reloj);
  if (opciones.push) constructor = constructor.overrideProvider(ConfigPush).useValue(opciones.push);
  const modulo = await constructor.compile();
  const app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  return { app: app as unknown as INestApplication<App>, prisma: app.get(PrismaService), reloj };
}

/**
 * Borra las salas y, por ON DELETE CASCADE, lo que cuelga de ellas. Deja las palabras base.
 * No usa TRUNCATE ... CASCADE porque vaciaría toda la tabla palabras, que referencia a salas.
 */
export async function limpiar(prisma: PrismaService): Promise<void> {
  await prisma.sala.deleteMany();
}
