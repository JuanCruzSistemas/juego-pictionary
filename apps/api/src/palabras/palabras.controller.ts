import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { PalabraPropia } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { SesionGuard } from '../sesion/sesion.guard.js';
import { JugadorActual } from '../sesion/jugador-actual.decorator.js';
import { problemaDeLaPalabra } from '../turnos/palabra.js';
import { PalabrasService } from './palabras.service.js';

/** Las mismas reglas que una palabra propia al elegir. Los espacios de los bordes se recortan. */
const palabraNuevaSchema = z.strictObject(
  {
    texto: z
      .string({ error: 'Escribí una palabra.' })
      .transform((t) => t.trim())
      .superRefine((t, ctx) => {
        const problema = t.length === 0 ? 'Escribí una palabra.' : problemaDeLaPalabra(t);
        if (problema) ctx.addIssue({ code: 'custom', message: problema });
      }),
  },
  { error: 'Escribí una palabra.' },
);

@Controller('palabras')
@UseGuards(SesionGuard)
export class PalabrasController {
  constructor(private readonly palabras: PalabrasService) {}

  @Get()
  lista(@JugadorActual() yo: Jugador): Promise<PalabraPropia[]> {
    return this.palabras.deLaSala(yo);
  }

  @Post()
  sumar(@JugadorActual() yo: Jugador, @Body({ schema: palabraNuevaSchema }) body: { texto: string }): Promise<PalabraPropia[]> {
    return this.palabras.sumar(yo, body.texto);
  }

  @Delete(':id')
  quitar(@JugadorActual() yo: Jugador, @Param('id') id: string): Promise<PalabraPropia[]> {
    return this.palabras.quitar(yo, id);
  }
}
