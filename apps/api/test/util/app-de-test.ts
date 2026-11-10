import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configurarApp } from '../../src/configurar.js';
import { PrismaService } from '../../src/db/prisma.service.js';
import { Reloj } from '../../src/comun/reloj.js';
import { ConfigPush } from '../../src/push/config.js';
import { EnviadorPush, type Destino, type OpcionesDeEnvio } from '../../src/push/enviador.js';
import { NotificacionesService } from '../../src/push/notificaciones.service.js';

/** Enviador de push falso: guarda lo que se mandó y puede simular respuestas del servicio de push. */
export class EnviadorDeTest extends EnviadorPush {
  enviados: { endpoint: string; payload: { notification: { title: string; body: string; data: { onActionClick: { default: { url: string } } } } }; opciones: OpcionesDeEnvio }[] = [];
  /** Qué hacer con cada endpoint: un código HTTP de error, 'colgado' (no responde nunca) o 'tira' (error sin código). */
  respuestas = new Map<string, number | 'colgado' | 'tira'>();

  async enviar(destino: Destino, payload: string, opciones: OpcionesDeEnvio): Promise<void> {
    this.enviados.push({ endpoint: destino.endpoint, payload: JSON.parse(payload), opciones });
    const r = this.respuestas.get(destino.endpoint);
    if (r === 'colgado') return new Promise(() => {});
    if (r === 'tira') throw new Error('se cayó la red');
    if (typeof r === 'number') throw Object.assign(new Error(`HTTP ${r}`), { statusCode: r });
  }
}

export const PUSH_ACTIVO: Partial<ConfigPush> = {
  clavePublica: 'PUBLICA',
  clavePrivada: 'PRIVADA',
  subject: 'mailto:prueba@ejemplo.com',
  activos: true,
};

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

export type AppDeTest = {
  app: INestApplication<App>;
  prisma: PrismaService;
  reloj: RelojDeTest;
  enviador: EnviadorDeTest;
  /** Espera a que terminen los avisos que salieron en segundo plano. */
  esperarAvisos: () => Promise<void>;
};

/** Claves VAPID de prueba: sin ellas, los avisos quedan apagados. */
export type OpcionesDeTest = { push?: Partial<ConfigPush> };
// En todos los tests se usa el enviador falso: nunca se manda nada de verdad.

export async function crearAppDeTest(opciones: OpcionesDeTest = {}): Promise<AppDeTest> {
  const reloj = new RelojDeTest();
  const enviador = new EnviadorDeTest();
  let constructor = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Reloj)
    .useValue(reloj)
    .overrideProvider(EnviadorPush)
    .useValue(enviador);
  if (opciones.push) constructor = constructor.overrideProvider(ConfigPush).useValue(opciones.push);
  const modulo = await constructor.compile();
  const app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  const notificaciones = app.get(NotificacionesService);
  return {
    app: app as unknown as INestApplication<App>,
    prisma: app.get(PrismaService),
    reloj,
    enviador,
    esperarAvisos: () => notificaciones.esperarEnvios(),
  };
}

/**
 * Borra las salas y, por ON DELETE CASCADE, lo que cuelga de ellas. Deja las palabras base.
 * No usa TRUNCATE ... CASCADE porque vaciaría toda la tabla palabras, que referencia a salas.
 */
export async function limpiar(prisma: PrismaService): Promise<void> {
  await prisma.sala.deleteMany();
}
