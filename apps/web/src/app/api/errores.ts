import { HttpErrorResponse } from '@angular/common/http';
import type { CodigoError, ErrorApi } from '@garabato/shared';

/** El error de la API, o null si fue un problema de red u otra cosa. */
export function errorDeApi(e: unknown): ErrorApi | null {
  if (!(e instanceof HttpErrorResponse)) return null;
  const cuerpo = e.error as Partial<ErrorApi> | null;
  return cuerpo && typeof cuerpo.codigo === 'string' && typeof cuerpo.mensaje === 'string'
    ? { codigo: cuerpo.codigo as CodigoError, mensaje: cuerpo.mensaje }
    : null;
}

/**
 * true si el servidor no respondió: sin respuesta (status 0), un 502/503/504 del proxy de Render
 * mientras el servicio arranca, o un 5xx sin el cuerpo de nuestra API.
 */
export function servidorNoRespondio(e: unknown): boolean {
  if (!(e instanceof HttpErrorResponse)) return false;
  if (e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504) return true;
  return e.status >= 500 && errorDeApi(e) === null;
}

export const SIN_RED = 'Sin conexión. Revisá tu internet y probá de nuevo.';
export const DESPERTANDO = 'El servidor se está despertando. Probá de nuevo en unos segundos.';

/** El mensaje para mostrar en pantalla ante un error, sin dejar nunca un error genérico en blanco. */
export function mensajeDeError(e: unknown, porDefecto: string): string {
  if (servidorNoRespondio(e)) return navigator.onLine === false ? SIN_RED : DESPERTANDO;
  return errorDeApi(e)?.mensaje ?? porDefecto;
}
