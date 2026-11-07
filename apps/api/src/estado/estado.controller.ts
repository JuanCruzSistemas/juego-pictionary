import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Estado } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { SesionGuard } from '../sesion/sesion.guard.js';
import { JugadorActual } from '../sesion/jugador-actual.decorator.js';
import { vistaDelAnterior, vistaDelTurno } from '../turnos/vista.js';
import { TurnosService } from '../turnos/turnos.service.js';

const publico = (j: Jugador) => ({ id: j.id, nombre: j.nombre, lugar: j.lugar });

/** Estado del juego para quien pregunta. Inicio lo consulta cada 5 s. */
@Controller('estado')
@UseGuards(SesionGuard)
export class EstadoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly turnos: TurnosService,
  ) {}

  @Get()
  async estado(@JugadorActual() yo: Jugador): Promise<Estado> {
    let sala = await this.leer(yo.salaId);
    if (sala.jugadores.length === 2 && sala.turnos.length === 0) {
      await this.turnos.asegurarPrimerTurno(sala.id);
      sala = await this.leer(yo.salaId);
    }
    const otro = sala.jugadores.find((j) => j.id !== yo.id);
    const [actual, anterior] = sala.turnos;

    return {
      yo: publico(yo),
      otro: otro ? publico(otro) : null,
      invitacion: sala.invitacion,
      turno: actual ? vistaDelTurno(actual, yo.id, actual._count.intentos) : null,
      anterior: vistaDelAnterior(anterior, yo.id),
      salteos: await this.turnos.salteosDe(yo.id),
    };
  }

  private leer(salaId: string) {
    return this.prisma.sala.findUniqueOrThrow({
      where: { id: salaId },
      include: {
        jugadores: true,
        // El actual y el anterior.
        turnos: { orderBy: { numero: 'desc' }, take: 2, include: { _count: { select: { intentos: true } } } },
      },
    });
  }
}
