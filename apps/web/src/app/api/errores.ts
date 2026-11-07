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
