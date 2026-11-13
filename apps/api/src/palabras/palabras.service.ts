import { Injectable } from '@nestjs/common';
import type { PalabraPropia } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { datosInvalidos, palabraNoEncontrada } from '../comun/errores.js';
import { normalizar } from '../comun/texto.js';

/** Palabras propias de la sala: los chistes internos. Entran al sorteo junto con las palabras base. */
@Injectable()
export class PalabrasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Las de la sala, de la más nueva a la más vieja. */
  async deLaSala(yo: Jugador): Promise<PalabraPropia[]> {
    const palabras = await this.prisma.palabra.findMany({
      where: { salaId: yo.salaId },
      orderBy: [{ creadaEn: 'desc' }, { id: 'desc' }],
    });
    return palabras.map((p) => ({ id: p.id, texto: p.texto }));
  }

  /** Suma una palabra. Si ya está (en la sala o en la lista base, sin tildes ni mayúsculas), no la repite. */
  async sumar(yo: Jugador, texto: string): Promise<PalabraPropia[]> {
    const clave = normalizar(texto);
    const existentes = await this.prisma.palabra.findMany({
      where: { OR: [{ salaId: null }, { salaId: yo.salaId }] },
      select: { texto: true },
    });
    if (existentes.some((p) => normalizar(p.texto) === clave)) throw datosInvalidos('Esa palabra ya está en el juego.');
    await this.prisma.palabra.create({ data: { texto, salaId: yo.salaId } });
    return this.deLaSala(yo);
  }

  /** Saca una palabra propia. Las palabras base no se pueden sacar. */
  async quitar(yo: Jugador, id: string): Promise<PalabraPropia[]> {
    const r = await this.prisma.palabra.deleteMany({ where: { id, salaId: yo.salaId } });
    if (r.count === 0) throw palabraNoEncontrada();
    return this.deLaSala(yo);
  }
}
