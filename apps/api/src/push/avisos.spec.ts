import { randomUUID } from 'node:crypto';
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

describe('topicDe (header Topic de RFC 8030: hasta 32 caracteres base64url)', () => {
  const VALIDO = /^[A-Za-z0-9_-]{1,32}$/;

  it('un uuid (36 caracteres) queda sin guiones: 32 caracteres hexadecimales', () => {
    const id = '3f2a9c1e-7b4d-4e8a-9f10-2c3d4e5f6a7b';
    expect(id).toHaveLength(36);
    const t = topicDe(id);
    expect(t).toBe('3f2a9c1e7b4d4e8a9f102c3d4e5f6a7b');
    expect(t).toHaveLength(32);
  });

  it('mil uuid al azar: todos con largo de 1 a 32 y alfabeto base64url, y distintos', () => {
    const topics = Array.from({ length: 1000 }, () => topicDe(randomUUID()));
    for (const t of topics) expect(t).toMatch(VALIDO);
    expect(new Set(topics).size).toBe(1000);
  });

  it.each([
    ['más largo que un uuid', 'a'.repeat(80)],
    ['con caracteres fuera de base64url', 'sala:1/2+3=4'],
    ['con espacios y tildes', 'sala de Juancho ñ'],
  ])('un id %s igual da un topic válido (por hash), y siempre el mismo', (_, id) => {
    expect(topicDe(id)).toMatch(VALIDO);
    expect(topicDe(id)).toBe(topicDe(id));
  });
});
