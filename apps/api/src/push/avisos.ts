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

/**
 * Topic de push: el servicio de push reemplaza un aviso todavía no entregado por el nuevo con el
 * mismo topic. Tiene que ser base64url de hasta 32 caracteres: el uuid de la sala sin guiones.
 */
export function topicDe(salaId: string): string {
  return salaId.replace(/-/g, '').slice(0, 32);
}
