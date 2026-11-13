import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { FiltroHistorial, PaginaHistorial } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { SesionGuard } from '../sesion/sesion.guard.js';
import { JugadorActual } from '../sesion/jugador-actual.decorator.js';
import { HistorialService } from './historial.service.js';

const consultaSchema = z.object({
  filtro: z.enum(['todos', 'juego', 'libres'], { error: 'El filtro tiene que ser todos, juego o libres.' }).default('todos'),
  antes: z.iso.datetime({ error: 'antes tiene que ser una fecha ISO 8601.' }).optional(),
});

@Controller('historial')
@UseGuards(SesionGuard)
export class HistorialController {
  constructor(private readonly historial: HistorialService) {}

  @Get()
  pagina(
    @JugadorActual() yo: Jugador,
    @Query({ schema: consultaSchema }) consulta: { filtro: FiltroHistorial; antes?: string },
  ): Promise<PaginaHistorial> {
    return this.historial.pagina(yo, consulta.filtro, consulta.antes ? new Date(consulta.antes) : null);
  }
}
