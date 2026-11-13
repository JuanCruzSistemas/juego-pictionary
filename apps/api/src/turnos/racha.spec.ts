import { calcularRacha } from './racha.js';

/** Una fecha en hora de Argentina (UTC−3). */
const ar = (dia: number, hora = 12, mes = 11) => new Date(Date.UTC(2026, mes - 1, dia, hora + 3));

describe('calcularRacha', () => {
  it('sin aciertos, 0', () => {
    expect(calcularRacha([], ar(13))).toEqual({ dias: 0, hoy: false });
  });

  it('cuenta los días seguidos hasta hoy', () => {
    expect(calcularRacha([ar(11), ar(12), ar(13, 9), ar(13, 20)], ar(13, 22))).toEqual({ dias: 3, hoy: true });
  });

  it('si hoy todavía no adivinaron, sigue viva con los días hasta ayer', () => {
    expect(calcularRacha([ar(11), ar(12)], ar(13, 10))).toEqual({ dias: 2, hoy: false });
  });

  it('un día sin aciertos la corta', () => {
    expect(calcularRacha([ar(9), ar(10), ar(12)], ar(13))).toEqual({ dias: 1, hoy: false });
    expect(calcularRacha([ar(9), ar(10)], ar(13))).toEqual({ dias: 0, hoy: false });
  });

  it('el día cambia a la medianoche de Argentina, no a la de UTC', () => {
    // 23:30 del 12 en Argentina son las 02:30 del 13 en UTC: sigue siendo el 12.
    expect(calcularRacha([ar(12, 23.5)], ar(13, 0.5))).toEqual({ dias: 1, hoy: false });
    expect(calcularRacha([ar(12, 23.5)], ar(12, 23.9))).toEqual({ dias: 1, hoy: true });
  });

  it('cruza fin de mes', () => {
    expect(calcularRacha([ar(31, 12, 10), ar(1)], ar(1, 18))).toEqual({ dias: 2, hoy: true });
  });
});
