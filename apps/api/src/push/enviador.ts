import { Injectable } from '@nestjs/common';
import webpush from 'web-push';
import { ConfigPush } from './config.js';

export type Destino = { endpoint: string; keys: { p256dh: string; auth: string } };
export type OpcionesDeEnvio = { ttlSegundos: number; topic: string };

/** Error del servicio de push con el código HTTP que devolvió (404 y 410: la suscripción ya no existe). */
export type ErrorDeEnvio = Error & { statusCode?: number };

/** Manda un aviso a una suscripción. Es una clase abstracta para poder cambiarla en los tests. */
export abstract class EnviadorPush {
  abstract enviar(destino: Destino, payload: string, opciones: OpcionesDeEnvio): Promise<void>;
}

/** Con web-push y las claves VAPID. */
@Injectable()
export class EnviadorWebPush extends EnviadorPush {
  constructor(private readonly config: ConfigPush) {
    super();
  }

  async enviar(destino: Destino, payload: string, opciones: OpcionesDeEnvio): Promise<void> {
    if (!this.config.activos) return;
    await webpush.sendNotification(destino, payload, {
      vapidDetails: {
        subject: this.config.subject!,
        publicKey: this.config.clavePublica!,
        privateKey: this.config.clavePrivada!,
      },
      TTL: opciones.ttlSegundos,
      topic: opciones.topic,
      urgency: 'normal',
      timeout: 10_000, // inactividad del socket; el tiempo total lo limita NotificacionesService
    });
  }
}
