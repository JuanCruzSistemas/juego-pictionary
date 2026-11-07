import { HttpException, HttpStatus } from '@nestjs/common';
import type { CodigoError, ErrorApi } from '@garabato/shared';

/** Error con cuerpo ErrorApi: la web decide qué mostrar según `codigo`. */
export class ErrorDeApi extends HttpException {
  constructor(estado: HttpStatus, codigo: CodigoError, mensaje: string) {
    const cuerpo: ErrorApi = { codigo, mensaje };
    super(cuerpo, estado);
  }
}

export const salaNoEncontrada = () =>
  new ErrorDeApi(HttpStatus.NOT_FOUND, 'sala_no_encontrada', 'Este link no corresponde a ninguna sala.');

export const salaLlena = () =>
  new ErrorDeApi(HttpStatus.CONFLICT, 'sala_llena', 'Esta sala ya tiene a sus dos personas.');

export const sesionInvalida = () =>
  new ErrorDeApi(HttpStatus.UNAUTHORIZED, 'sesion_invalida', 'No encontramos tu sesión en este dispositivo.');

export const datosInvalidos = (mensaje: string) =>
  new ErrorDeApi(HttpStatus.BAD_REQUEST, 'datos_invalidos', mensaje);
