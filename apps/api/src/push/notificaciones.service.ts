import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service.js';
import { ConfigPush } from './config.js';
import { EnviadorPush, type ErrorDeEnvio } from './enviador.js';
import { payloadDe, topicDe, type Aviso } from './avisos.js';

/** Un aviso que no llega en 24 h ya no sirve. */
export const TTL_SEGUNDOS = 24 * 60 * 60;
/** Tiempo máximo por envío, además del timeout de socket de web-push. */
export const TIEMPO_MAXIMO_MS = 10_000;

/**
 * Manda avisos a todos los dispositivos de un jugador. Nunca afecta al juego: `avisar` no espera
 * ni tira errores; se llama después de que la transacción del juego terminó, y cualquier falla
 * queda solo en el log. Si el servicio de push responde 404 o 410, la suscripción se borra.
 */
@Injectable()
export class NotificacionesService {
  private readonly log = new Logger('Avisos');
  private readonly enCurso = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigPush,
    private readonly enviador: EnviadorPush,
  ) {}

  avisar(jugadorId: string, salaId: string, aviso: Aviso): void {
    if (!this.config.activos) return;
    try {
      const envio = this.entregar(jugadorId, salaId, aviso)
        .catch((e: unknown) => this.log.warn(`No se pudo avisar a ${jugadorId}: ${String(e)}`))
        .finally(() => this.enCurso.delete(envio));
      this.enCurso.add(envio);
    } catch (e) {
      this.log.warn(`No se pudo avisar a ${jugadorId}: ${String(e)}`);
    }
  }

  /** Para los tests: espera a que terminen los envíos en curso. */
  async esperarEnvios(): Promise<void> {
    while (this.enCurso.size > 0) await Promise.allSettled([...this.enCurso]);
  }

  private async entregar(jugadorId: string, salaId: string, aviso: Aviso): Promise<void> {
    const suscripciones = await this.prisma.suscripcionPush.findMany({ where: { jugadorId } });
    const payload = payloadDe(aviso, salaId);
    await Promise.allSettled(
      suscripciones.map(async (s) => {
        try {
          await conTiempoMaximo(
            this.enviador.enviar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
              ttlSegundos: TTL_SEGUNDOS,
              topic: topicDe(salaId),
            }),
          );
        } catch (e) {
          const estado = (e as ErrorDeEnvio)?.statusCode;
          if (estado === 404 || estado === 410) {
            // El navegador dio de baja la suscripción: no sirve más.
            await this.prisma.suscripcionPush.deleteMany({ where: { id: s.id, endpoint: s.endpoint } });
            this.log.log(`Suscripción ${s.id} borrada (${estado}).`);
          } else {
            this.log.warn(`Falló el aviso a la suscripción ${s.id}: ${estado ?? String(e)}`);
          }
        }
      }),
    );
  }
}

function conTiempoMaximo<T>(promesa: Promise<T>): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`sin respuesta en ${TIEMPO_MAXIMO_MS} ms`)), TIEMPO_MAXIMO_MS);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}
