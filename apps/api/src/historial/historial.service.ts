import { Injectable } from '@nestjs/common';
import type { FiltroHistorial, ItemHistorial, PaginaHistorial, Stroke } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';

/** Cuántos dibujos trae cada página: cada uno viaja con sus trazos para la miniatura. */
export const POR_PAGINA = 12;

/**
 * El historial de la sala: los dibujos de turnos terminados (adivinados o rendidos) y los dibujos
 * libres, del más nuevo al más viejo. Los turnos en curso no aparecen: su palabra todavía es secreta.
 */
@Injectable()
export class HistorialService {
  constructor(private readonly prisma: PrismaService) {}

  async pagina(yo: Jugador, filtro: FiltroHistorial, antes: Date | null): Promise<PaginaHistorial> {
    const juego = filtro === 'libres' ? [] : await this.deJuego(yo, antes);
    const libres = filtro === 'juego' ? [] : await this.libres(yo, antes);
    const todos = [...juego, ...libres].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
    const items = todos.slice(0, POR_PAGINA);
    return { items, siguiente: todos.length > POR_PAGINA ? items.at(-1)!.fecha : null };
  }

  /**
   * Una página y una más de cada fuente, para saber si hay siguiente. Adivinados y rendidos van en
   * consultas separadas porque se ordenan por fechas distintas (adivinadoEn y enviadoEn).
   */
  private async deJuego(yo: Jugador, antes: Date | null): Promise<ItemHistorial[]> {
    const incluir = { dibujo: true, dibuja: true, _count: { select: { intentos: true } } } as const;
    const [adivinados, rendidos] = await Promise.all([
      this.prisma.turno.findMany({
        where: { salaId: yo.salaId, estado: 'adivinado', dibujo: { isNot: null }, ...(antes && { adivinadoEn: { lt: antes } }) },
        orderBy: [{ adivinadoEn: 'desc' }, { id: 'desc' }],
        take: POR_PAGINA + 1,
        include: incluir,
      }),
      this.prisma.turno.findMany({
        where: { salaId: yo.salaId, estado: 'rendido', dibujo: { isNot: null }, ...(antes && { enviadoEn: { lt: antes } }) },
        orderBy: [{ enviadoEn: 'desc' }, { id: 'desc' }],
        take: POR_PAGINA + 1,
        include: incluir,
      }),
    ]);
    return [...adivinados, ...rendidos].map((t) => ({
      tipo: 'juego',
      id: t.id,
      palabra: t.palabra ?? '',
      autor: t.dibuja.nombre,
      mio: t.dibujaId === yo.id,
      resultado: t.estado as 'adivinado' | 'rendido',
      intentos: t._count.intentos,
      fecha: (t.adivinadoEn ?? t.enviadoEn ?? t.creadoEn).toISOString(),
      trazos: t.dibujo!.trazos as Stroke[],
    }));
  }

  private async libres(yo: Jugador, antes: Date | null): Promise<ItemHistorial[]> {
    const dibujos = await this.prisma.dibujo.findMany({
      where: { turnoId: null, autor: { salaId: yo.salaId }, ...(antes && { creadoEn: { lt: antes } }) },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: POR_PAGINA + 1,
      include: { autor: true },
    });
    return dibujos.map((d) => ({
      tipo: 'libre',
      id: d.id,
      autor: d.autor.nombre,
      mio: d.autorId === yo.id,
      fecha: d.creadoEn.toISOString(),
      trazos: d.trazos as Stroke[],
    }));
  }
}
