import type { NestExpressApplication } from '@nestjs/platform-express';
import { pipeDeValidacion } from './comun/validacion.js';
import { FiltroDeErrores } from './comun/filtro-de-errores.js';
import { LIMITE_DEL_BODY } from './dibujos/reglas.js';

/** Configuración compartida entre main.ts y los tests e2e. */
export function configurarApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api', { exclude: ['health'] });
  // El default de Express es 100 KB; un dibujo rápido en un celular de 240 Hz pesa ~110 KB.
  app.useBodyParser('json', { limit: LIMITE_DEL_BODY });
  app.useGlobalPipes(pipeDeValidacion);
  app.useGlobalFilters(new FiltroDeErrores());
}
