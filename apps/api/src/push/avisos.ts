import { createHash } from 'node:crypto';
/** Un aviso, antes de convertirlo en el payload que entiende el service worker de Angular. */
export type Aviso = { titulo: string; cuerpo: string; url: string };

/** Textos de Avisos.dc.html, con el nombre real de la otra persona. */
export const avisos = {
  /** A quien adivina, cuando la otra persona manda el dibujo. */
  dibujo: (quienDibujo: string): Aviso => ({
    titulo: 'Te dibujaron algo',
    cuerpo: `${quienDibujo} terminó su dibujo. Te toca adivinar.`,
    url: '/adivinar',
  }),
  /** A quien dibujó, cuando aciertan su dibujo. La palabra solo va en este aviso. */
  acierto: (palabra: string, turnoId: string): Aviso => ({
    titulo: 'Adivinó tu dibujo',
    cuerpo: `Era ${palabra}. Ahora te toca adivinar a vos.`,
    url: `/acierto/${turnoId}`,
  }),
  /** A quien dibujó, cuando la otra persona se rinde. Como en el acierto, la palabra va en el aviso. */
  rendicion: (quienSeRindio: string, palabra: string, turnoId: string): Aviso => ({
    titulo: `${quienSeRindio} se rindió`,
    cuerpo: `Era ${palabra}. Ahora te toca adivinar a vos.`,
    url: `/acierto/${turnoId}`,
  }),
  /** A quien adivina, cuando le mandan una pista. El texto de la pista va en el aviso. */
  pista: (texto: string): Aviso => ({
    titulo: 'Llegó una pista',
    cuerpo: texto,
    url: '/adivinar',
  }),
  /** A quien recibe un dibujo libre. Abre ese dibujo. */
  libre: (quienDibujo: string, libreId: string): Aviso => ({
    titulo: `${quienDibujo} te dejó un dibujito`,
    cuerpo: 'Sin nada que adivinar. Abrilo cuando quieras.',
    url: `/recibido/${libreId}`,
  }),
  /** A quien pasa a dibujar, cuando la otra persona saltea. */
  salteo: (quienSalteo: string): Aviso => ({
    titulo: 'Te toca dibujar',
    cuerpo: `${quienSalteo} te pasó el turno. Elegí qué dibujar.`,
    url: '/elegir',
  }),
};

/**
 * El payload para el service worker de Angular (ngsw): muestra la notificación y, al tocarla,
 * enfoca la app y la lleva a `url`, o la abre ahí. El `tag` por sala deja un solo aviso de la
 * partida en el celular; `renotify` hace que el nuevo igual suene.
 */
export function payloadDe(aviso: Aviso, salaId: string): string {
  return JSON.stringify({
    notification: {
      title: aviso.titulo,
      body: aviso.cuerpo,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      lang: 'es',
      tag: `garabato-${salaId}`,
      renotify: true,
      data: {
        onActionClick: {
          default: { operation: 'navigateLastFocusedOrOpen', url: aviso.url },
        },
      },
    },
  });
}

/** RFC 8030: el header Topic admite hasta 32 caracteres del alfabeto base64url. */
const TOPIC_VALIDO = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * Topic de push: el servicio de push reemplaza un aviso todavía no entregado por el nuevo con el
 * mismo topic. Para un uuid (36 caracteres) es el uuid sin guiones: 32 caracteres hexadecimales.
 * Si el id no diera un topic válido, se usa su SHA-256 en base64url recortado a 32: FCM rechaza
 * con 400 un topic más largo o con otros caracteres.
 */
export function topicDe(salaId: string): string {
  const sinGuiones = salaId.replace(/-/g, '');
  if (TOPIC_VALIDO.test(sinGuiones)) return sinGuiones;
  return createHash('sha256').update(salaId).digest('base64url').slice(0, 32);
}
