import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { ClavePush } from '@garabato/shared';
import type { Jugador } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { SesionGuard } from '../sesion/sesion.guard.js';
import { JugadorActual } from '../sesion/jugador-actual.decorator.js';
import { ConfigPush } from './config.js';
import { desuscripcionSchema, suscripcionSchema, type SuscripcionValidada } from './suscripcion.js';

@Controller('push')
export class PushController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigPush,
  ) {}

  /** Pública: la web la necesita para suscribirse. null si los avisos están apagados. */
  @Get('clave')
  clave(): ClavePush {
    return { clavePublica: this.config.clavePublica };
  }

  /**
   * Guarda la suscripción de este dispositivo. El endpoint identifica al dispositivo: si ya existía
   * (otra sesión, otra sala), pasa a quien la manda ahora y se actualizan sus claves.
   */
  @Post('suscripciones')
  @HttpCode(204)
  @UseGuards(SesionGuard)
  async suscribir(@JugadorActual() yo: Jugador, @Body({ schema: suscripcionSchema }) s: SuscripcionValidada): Promise<void> {
    await this.prisma.suscripcionPush.upsert({
      where: { endpoint: s.endpoint },
      create: { jugadorId: yo.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth },
      update: { jugadorId: yo.id, p256dh: s.keys.p256dh, auth: s.keys.auth },
    });
  }

  /** Borra la suscripción de este dispositivo, si es de quien pide. Si no existe, no pasa nada. */
  @Delete('suscripciones')
  @HttpCode(204)
  @UseGuards(SesionGuard)
  async desuscribir(@JugadorActual() yo: Jugador, @Body({ schema: desuscripcionSchema }) body: { endpoint: string }): Promise<void> {
    await this.prisma.suscripcionPush.deleteMany({ where: { endpoint: body.endpoint, jugadorId: yo.id } });
  }
}
