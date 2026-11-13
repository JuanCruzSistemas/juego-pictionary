import { Injectable } from '@nestjs/common';
import type { DejarLibreRespuesta, LibreGuardado, LibreNuevo, Stroke } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { Reloj } from '../comun/reloj.js';
import { faltaLaOtraPersona, libreNoEncontrado } from '../comun/errores.js';
import { duracionDe } from '../dibujos/reglas.js';
import { NotificacionesService } from '../push/notificaciones.service.js';
import { avisos } from '../push/avisos.js';

/**
 * Dibujos libres: un dibujo sin nada que adivinar para la otra persona.
 * Se guardan en la tabla de dibujos sin turno; la sala sale de quien lo dibujó.
 */
@Injectable()
export class LibresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async dejar(yo: Jugador, trazos: Stroke[]): Promise<DejarLibreRespuesta> {
    const otro = await this.prisma.jugador.findFirst({ where: { salaId: yo.salaId, id: { not: yo.id } } });
    if (!otro) throw faltaLaOtraPersona();
    const dibujo = await this.prisma.dibujo.create({
      data: { autorId: yo.id, trazos, duracionMs: duracionDe(trazos), creadoEn: this.reloj.ahora() },
    });
    // Después de guardarlo: un aviso que falla no afecta al dibujo.
    this.notificaciones.avisar(otro.id, yo.salaId, avisos.libre(yo.nombre, dibujo.id));
    return { id: dibujo.id };
  }

  /** Un dibujo libre de la sala. Si lo abre quien lo recibió por primera vez, queda visto. */
  async ver(yo: Jugador, id: string): Promise<LibreGuardado> {
    const dibujo = await this.prisma.dibujo.findFirst({
      where: { id, turnoId: null, autor: { salaId: yo.salaId } },
      include: { autor: true },
    });
    if (!dibujo) throw libreNoEncontrado();
    const mio = dibujo.autorId === yo.id;
    if (!mio && !dibujo.vistoEn) {
      await this.prisma.dibujo.updateMany({ where: { id, vistoEn: null }, data: { vistoEn: this.reloj.ahora() } });
    }
    return {
      id: dibujo.id,
      autor: dibujo.autor.nombre,
      mio,
      creadoEn: dibujo.creadoEn.toISOString(),
      trazos: dibujo.trazos as Stroke[],
      duracionMs: dibujo.duracionMs,
    };
  }

  /** El último dibujo libre que la otra persona le dejó a `yo` y todavía no abrió. */
  async nuevoPara(yo: Jugador): Promise<LibreNuevo | null> {
    const d = await this.prisma.dibujo.findFirst({
      where: { turnoId: null, vistoEn: null, autor: { salaId: yo.salaId, id: { not: yo.id } } },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      select: { id: true, creadoEn: true },
    });
    return d ? { id: d.id, creadoEn: d.creadoEn.toISOString() } : null;
  }
}
