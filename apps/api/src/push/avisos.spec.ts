import { avisos, payloadDe, topicDe } from './avisos.js';

describe('avisos', () => {
  it('"Te dibujaron algo", con el nombre real', () => {
    expect(avisos.dibujo('Mili')).toEqual({
      titulo: 'Te dibujaron algo',
      cuerpo: 'Mili terminó su dibujo. Te toca adivinar.',
      url: '/adivinar',
    });
  });

  it('"Adivinó tu dibujo", con la palabra y el acierto de ese turno', () => {
    expect(avisos.acierto('Mate', 't-123')).toEqual({
      titulo: 'Adivinó tu dibujo',
      cuerpo: 'Era Mate. Ahora te toca adivinar a vos.',
      url: '/acierto/t-123',
    });
  });

  it('"Te toca dibujar", con el texto acordado', () => {
    expect(avisos.salteo('Juanchi')).toEqual({
      titulo: 'Te toca dibujar',
      cuerpo: 'Juanchi te pasó el turno. Elegí qué dibujar.',
      url: '/elegir',
    });
  });
});

describe('payloadDe', () => {
  it('arma la notificación para el service worker de Angular, que abre la pantalla al tocarla', () => {
    const p = JSON.parse(payloadDe(avisos.dibujo('Mili'), 'sala-1'));
    expect(p).toEqual({
      notification: {
        title: 'Te dibujaron algo',
        body: 'Mili terminó su dibujo. Te toca adivinar.',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        lang: 'es',
        tag: 'garabato-sala-1',
        renotify: true,
        data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: '/adivinar' } } },
      },
    });
  });
});

describe('topicDe', () => {
  it('el uuid de la sala sin guiones: base64url y 32 caracteres', () => {
    const t = topicDe('3f2a9c1e-7b4d-4e8a-9f10-2c3d4e5f6a7b');
    expect(t).toBe('3f2a9c1e7b4d4e8a9f102c3d4e5f6a7b');
    expect(t).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
  });
});
