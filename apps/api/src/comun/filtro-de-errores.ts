import { ArgumentsHost, Catch, HttpException, HttpStatus, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorApi } from '@garabato/shared';

/**
 * Los errores que no son ErrorDeApi, como los del body parser (JSON roto, demasiado grande),
 * salen igual con la forma ErrorApi, para que la web siempre pueda leer `codigo` y `mensaje`.
 */
@Catch()
export class FiltroDeErrores implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { estado, cuerpo } = traducir(error);
    res.status(estado).json(cuerpo);
  }
}

function traducir(error: unknown): { estado: number; cuerpo: unknown } {
  if (error instanceof HttpException) {
    const r = error.getResponse();
    if (typeof r === 'object' && r !== null && 'codigo' in r) return { estado: error.getStatus(), cuerpo: r };
    return { estado: error.getStatus(), cuerpo: errorGenerico(error.getStatus()) };
  }
  // Por si un error de body-parser llega sin envolver: trae `status`.
  const estado = (error as { status?: number })?.status;
  if (estado === 413 || estado === 400) return { estado, cuerpo: errorGenerico(estado) };
  console.error(error);
  return { estado: HttpStatus.INTERNAL_SERVER_ERROR, cuerpo: errorGenerico(500) };
}

const MENSAJES: Record<number, string> = {
  400: 'Los datos no llegaron bien. Probá de nuevo.',
  404: 'No existe.',
  // Nest convierte el "entity.too.large" de body-parser en un 413.
  413: 'El dibujo es demasiado grande para mandarlo.',
};

function errorGenerico(estado: number): ErrorApi {
  const mensaje = MENSAJES[estado] ?? (estado >= 500 ? 'Algo falló de nuestro lado. Probá de nuevo.' : 'No se pudo hacer.');
  return { codigo: 'datos_invalidos', mensaje };
}
