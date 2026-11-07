import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestConJugador } from './sesion.guard.js';

/** El jugador de la sesión. Usar junto con @UseGuards(SesionGuard). */
export const JugadorActual = createParamDecorator(
  (_: unknown, contexto: ExecutionContext) => contexto.switchToHttp().getRequest<RequestConJugador>().jugador,
);
