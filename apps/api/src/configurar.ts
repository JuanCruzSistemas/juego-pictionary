import type { NestExpressApplication } from '@nestjs/platform-express';
import { pipeDeValidacion } from './comun/validacion.js';
import { FiltroDeErrores } from './comun/filtro-de-errores.js';
import { LIMITE_DEL_BODY } from './dibujos/reglas.js';
import { CORS_MAX_AGE_S, origenPermitido } from './cors.js';
import { AdaptadorVivo } from './vivo/adaptador.js';

/**
 * Configuración compartida entre main.ts y los tests e2e.
 * `webOrigin` es el único origen al que se le permite llamar a la API desde el navegador
 * (en producción, la URL del sitio estático). En local la web pasa por el proxy de ng serve.
 */
export function configurarApp(
  app: NestExpressApplication,
  { webOrigin = process.env.WEB_ORIGIN }: { webOrigin?: string } = {},
): void {
  const origen = origenPermitido(webOrigin);
  if (origen) {
    // Como lista: la cabecera de permiso solo sale si el origen del pedido coincide.
    app.enableCors({ origin: [origen], maxAge: CORS_MAX_AGE_S });
  } else if (process.env.RENDER) {
    console.warn('WEB_ORIGIN falta o no es un origen válido: el navegador no va a poder llamar a la API.');
  }

  // Modo en vivo: Socket.IO en /socket.io, con el mismo origen permitido.
  app.useWebSocketAdapter(new AdaptadorVivo(app, origen));

  app.setGlobalPrefix('api', { exclude: ['health'] });
  // El default de Express es 100 KB; un dibujo rápido en un celular de 240 Hz pesa ~110 KB.
  app.useBodyParser('json', { limit: LIMITE_DEL_BODY });
  app.useGlobalPipes(pipeDeValidacion);
  app.useGlobalFilters(new FiltroDeErrores());
}
