import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Estado } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { SesionGuard } from '../sesion/sesion.guard.js';
import { JugadorActual } from '../sesion/jugador-actual.decorator.js';

const publico = (j: Jugador) => ({ id: j.id, nombre: j.nombre, lugar: j.lugar });

/** Estado del juego para quien pregunta. En el paso 4 se suma el turno actual. */
@Controller('estado')
@UseGuards(SesionGuard)
export class EstadoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async estado(@JugadorActual() yo: Jugador): Promise<Estado> {
    const sala = await this.prisma.sala.findUniqueOrThrow({
      where: { id: yo.salaId },
      include: { jugadores: true },
    });
    const otro = sala.jugadores.find((j) => j.id !== yo.id);
    return { yo: publico(yo), otro: otro ? publico(otro) : null, invitacion: sala.invitacion };
  }
}
