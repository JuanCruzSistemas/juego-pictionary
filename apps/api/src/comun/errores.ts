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

export const turnoNoEncontrado = () =>
  new ErrorDeApi(HttpStatus.NOT_FOUND, 'turno_no_encontrado', 'No encontramos ese turno.');

export const noEsTuTurno = (mensaje = 'Este turno lo dibuja la otra persona.') =>
  new ErrorDeApi(HttpStatus.FORBIDDEN, 'no_es_tu_turno', mensaje);

export const turnoCerrado = (mensaje: string) => new ErrorDeApi(HttpStatus.CONFLICT, 'turno_cerrado', mensaje);

export const sinSalteos = () =>
  new ErrorDeApi(HttpStatus.CONFLICT, 'sin_salteos', 'Ya usaste tus 3 salteos. Cada uno vuelve a la media hora de usarlo.');

export const dibujoNoDisponible = () =>
  new ErrorDeApi(HttpStatus.NOT_FOUND, 'dibujo_no_disponible', 'Todavía no hay un dibujo para este turno.');

export const faltaLaOtraPersona = () =>
  new ErrorDeApi(HttpStatus.CONFLICT, 'falta_la_otra_persona', 'Todavía no entró la otra persona.');

export const libreNoEncontrado = () =>
  new ErrorDeApi(HttpStatus.NOT_FOUND, 'libre_no_encontrado', 'No encontramos ese dibujo.');

export const palabraNoEncontrada = () =>
  new ErrorDeApi(HttpStatus.NOT_FOUND, 'palabra_no_encontrada', 'No encontramos esa palabra.');

export const resumenNoDisponible = () =>
  new ErrorDeApi(HttpStatus.CONFLICT, 'resumen_no_disponible', 'Este turno todavía no se adivinó.');
