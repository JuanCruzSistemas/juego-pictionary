import { Injectable } from '@nestjs/common';

/**
 * Claves VAPID, de las variables de entorno. Si falta alguna o el `subject` no es `mailto:` ni
 * `https:`, los avisos quedan apagados: la API arranca igual y lo avisa una vez en el log.
 */
@Injectable()
export class ConfigPush {
  readonly clavePublica: string | null;
  readonly clavePrivada: string | null;
  readonly subject: string | null;

  constructor() {
    const publica = process.env.VAPID_PUBLIC_KEY?.trim();
    const privada = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim();
    const completas = !!publica && !!privada && !!subject && /^(mailto:|https:)/.test(subject);
    this.clavePublica = completas ? publica : null;
    this.clavePrivada = completas ? privada : null;
    this.subject = completas ? subject : null;
    if (!completas) {
      console.warn('Avisos apagados: faltan VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT (mailto: o https:).');
    }
  }

  get activos(): boolean {
    return this.clavePublica !== null;
  }
}
