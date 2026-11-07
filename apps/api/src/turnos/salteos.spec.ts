import { contarSalteos } from './salteos.js';

const min = (n: number) => n * 60 * 1000;
const t0 = new Date('2026-11-07T13:00:00.000Z');
const a = (ms: number) => new Date(t0.getTime() + ms);

describe('contarSalteos', () => {
  it('sin usar, quedan 3 y no hay próximo', () => {
    expect(contarSalteos([], t0)).toEqual({ quedan: 3, maximo: 3, proximoEn: null });
  });

  it('gastás uno: a los 29 min te quedan 2 y a los 30 volvés a tener 3', () => {
    expect(contarSalteos([t0], t0)).toEqual({ quedan: 2, maximo: 3, proximoEn: '2026-11-07T13:30:00.000Z' });
    expect(contarSalteos([t0], a(min(29)))).toMatchObject({ quedan: 2, proximoEn: '2026-11-07T13:30:00.000Z' });
    expect(contarSalteos([t0], a(min(30) - 1))).toMatchObject({ quedan: 2 });
    expect(contarSalteos([t0], a(min(30)))).toEqual({ quedan: 3, maximo: 3, proximoEn: null });
  });

  it('cada uno vuelve por su cuenta, y el próximo es el más viejo', () => {
    const usos = [t0, a(min(10)), a(min(20))];
    expect(contarSalteos(usos, a(min(25)))).toEqual({ quedan: 0, maximo: 3, proximoEn: '2026-11-07T13:30:00.000Z' });
    expect(contarSalteos(usos, a(min(30)))).toEqual({ quedan: 1, maximo: 3, proximoEn: '2026-11-07T13:40:00.000Z' });
    expect(contarSalteos(usos, a(min(45)))).toEqual({ quedan: 2, maximo: 3, proximoEn: '2026-11-07T13:50:00.000Z' });
    expect(contarSalteos(usos, a(min(50)))).toMatchObject({ quedan: 3, proximoEn: null });
  });
});
