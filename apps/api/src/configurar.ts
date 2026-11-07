import type { INestApplication } from '@nestjs/common';
import { pipeDeValidacion } from './comun/validacion.js';

/** Configuración compartida entre main.ts y los tests e2e. */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(pipeDeValidacion);
}
