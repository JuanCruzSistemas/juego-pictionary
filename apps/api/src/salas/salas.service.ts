import { Injectable } from '@nestjs/common';
import type { EntrarRespuesta, SalaPublica } from '@garabato/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { salaLlena, salaNoEncontrada } from '../comun/errores.js';
import { generarToken, hashToken } from '../sesion/tokens.js';

const LUGARES = 2;

@Injectable()
export class SalasService {
  constructor(private readonly prisma: PrismaService) {}

  async publica(invitacion: string): Promise<SalaPublica> {
    const sala = await this.buscar(invitacion);
    if (sala.jugadores.length >= LUGARES) return { llena: true };
    return { llena: false, invitadoPor: sala.jugadores[0]?.nombre ?? null };
  }

  /**
   * Suma a alguien a la sala. Si dos entran a la vez y chocan por el mismo lugar,
   * la restricción única (salaId, lugar) rechaza a uno y se reintenta con el lugar que queda.
   */
  async entrar(invitacion: string, nombre: string): Promise<EntrarRespuesta> {
    for (let intento = 0; intento < LUGARES; intento++) {
      const sala = await this.buscar(invitacion);
      if (sala.jugadores.length >= LUGARES) throw salaLlena();

      const ocupados = new Set(sala.jugadores.map((j) => j.lugar));
      const lugar = ocupados.has(1) ? 2 : 1;
      const token = generarToken();

      try {
        const jugador = await this.prisma.jugador.create({
          data: { salaId: sala.id, nombre, lugar, sesionHash: hashToken(token) },
        });
        return { token, jugador: { id: jugador.id, nombre: jugador.nombre, lugar: jugador.lugar } };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw salaLlena();
  }

  private async buscar(invitacion: string) {
    const sala = await this.prisma.sala.findUnique({
      where: { invitacion },
      include: { jugadores: { orderBy: { lugar: 'asc' }, select: { nombre: true, lugar: true } } },
    });
    if (!sala) throw salaNoEncontrada();
    return sala;
  }
}
