import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { finalize, retry, tap, throwError, timer } from 'rxjs';
import { ConexionService } from './conexion.service';
import { servidorNoRespondio } from './errores';
import { esDeLaApi } from './rutas';

/** Después de esto sin respuesta, se avisa "Despertando el servidor…". */
export const ESPERA_LENTA_MS = 2500;
/** Reintentos de los GET: 1, 2, 4 y después cada 8 s, cerca de un minuto en total. */
export const REINTENTOS = 10;
const espera = (n: number) => Math.min(1000 * 2 ** (n - 1), 8000);

/**
 * Para las llamadas a la API: avisa si tardan y reintenta los GET mientras el servidor no responda.
 * Los POST no se reintentan solos: cada pantalla muestra el error y deja reintentar a mano,
 * así nunca se manda dos veces algo sin que la persona lo pida.
 */
export const conexionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esDeLaApi(req.url)) return next(req);
  const conexion = inject(ConexionService);

  let lento = false;
  const aviso = setTimeout(() => {
    lento = true;
    conexion.empiezaLento();
  }, ESPERA_LENTA_MS);
  const terminar = () => {
    clearTimeout(aviso);
    if (lento) conexion.terminaLento();
    lento = false;
  };

  let pedido = next(req).pipe(
    tap({
      next: () => conexion.respondio(),
      error: (e: unknown) => {
        if (servidorNoRespondio(e)) conexion.noRespondio();
        else conexion.respondio(); // respondió, aunque sea con un error nuestro
      },
    }),
  );
  if (req.method === 'GET') {
    pedido = pedido.pipe(
      retry({
        count: REINTENTOS,
        delay: (e: unknown, n) => (servidorNoRespondio(e) ? timer(espera(n)) : throwError(() => e)),
      }),
    );
  }
  return pedido.pipe(finalize(terminar));
};
