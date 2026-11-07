import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { EntrarRespuesta, SalaPublica } from '@garabato/shared';
import { SalasService } from './salas.service.js';
import { entrarSchema } from './nombre.js';

@Controller('salas')
export class SalasController {
  constructor(private readonly salas: SalasService) {}

  /** Público: lo usa Bienvenida antes de que haya sesión. */
  @Get(':invitacion')
  publica(@Param('invitacion') invitacion: string): Promise<SalaPublica> {
    return this.salas.publica(invitacion);
  }

  @Post(':invitacion/jugadores')
  entrar(
    @Param('invitacion') invitacion: string,
    @Body({ schema: entrarSchema }) body: { nombre: string },
  ): Promise<EntrarRespuesta> {
    return this.salas.entrar(invitacion, body.nombre);
  }
}
