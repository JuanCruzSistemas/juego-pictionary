import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Jugador } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { sesionInvalida } from '../comun/errores.js';
import { hashToken } from './tokens.js';

export type RequestConJugador = Request & { jugador: Jugador };

/** Exige `Authorization: Bearer <token>` de una sesión existente y deja el jugador en la request. */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequestConJugador>();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw sesionInvalida();

    const jugador = await this.prisma.jugador.findUnique({ where: { sesionHash: hashToken(token) } });
    if (!jugador) throw sesionInvalida();

    req.jugador = jugador;
    return true;
  }
}
