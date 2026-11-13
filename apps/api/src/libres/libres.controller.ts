import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { DejarLibreRespuesta, LibreGuardado, Stroke } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { SesionGuard } from '../sesion/sesion.guard.js';
import { JugadorActual } from '../sesion/jugador-actual.decorator.js';
import { dibujoSchema } from '../dibujos/schema.js';
import { LibresService } from './libres.service.js';

@Controller('libres')
@UseGuards(SesionGuard)
export class LibresController {
  constructor(private readonly libres: LibresService) {}

  @Post()
  dejar(@JugadorActual() yo: Jugador, @Body({ schema: dibujoSchema }) body: { trazos: Stroke[] }): Promise<DejarLibreRespuesta> {
    return this.libres.dejar(yo, body.trazos);
  }

  @Get(':id')
  ver(@JugadorActual() yo: Jugador, @Param('id') id: string): Promise<LibreGuardado> {
    return this.libres.ver(yo, id);
  }
}
