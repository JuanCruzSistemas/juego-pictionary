import type { INestApplication } from '@nestjs/common';

/** Configuración compartida entre main.ts y los tests e2e. */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix('api', { exclude: ['health'] });
}
