import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { SalteoRespuesta, TurnoActual } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { SesionGuard } from '../sesion/sesion.guard.js';
import { JugadorActual } from '../sesion/jugador-actual.decorator.js';
import { TurnosService } from './turnos.service.js';
import { palabraSchema, type PalabraValidada } from './palabra.js';

@Controller('turnos')
@UseGuards(SesionGuard)
export class TurnosController {
  constructor(private readonly turnos: TurnosService) {}

  @Post(':id/palabra')
  @HttpCode(200)
  elegirPalabra(
    @JugadorActual() yo: Jugador,
    @Param('id') id: string,
    @Body({ schema: palabraSchema }) body: PalabraValidada,
  ): Promise<TurnoActual> {
    return this.turnos.elegirPalabra(yo, id, body);
  }

  @Post(':id/salteo')
  @HttpCode(200)
  saltear(@JugadorActual() yo: Jugador, @Param('id') id: string): Promise<SalteoRespuesta> {
    return this.turnos.saltear(yo, id);
  }
}
