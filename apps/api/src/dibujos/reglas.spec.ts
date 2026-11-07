import { PUNTOS_MAXIMOS, duracionDe, problemaDelDibujo } from './reglas.js';

const punto = (x = 0.5, y = 0.5, t = 0) => ({ x, y, t });
const trazo = (extra: object = {}) => ({ color: '#1B2A7A', width: 0.02, points: [punto(0.1, 0.1, 0), punto(0.2, 0.2, 16)], ...extra });

describe('problemaDelDibujo', () => {
  it('acepta un dibujo válido, con goma y en los bordes del rango', () => {
    expect(
      problemaDelDibujo([
        trazo(),
        trazo({ color: '#FFFFFF', width: 0.08 }),
        trazo({ width: 0.01, points: [punto(0, 1, 0), punto(1, 0, 0)] }), // mismo t: vale
      ]),
    ).toBeNull();
  });

  it.each([
    ['sin lista', undefined, 'Falta la lista de trazos.'],
    ['sin trazos', [], 'El dibujo no tiene trazos.'],
    ['201 trazos', Array.from({ length: 201 }, () => trazo()), 'El dibujo tiene 201 trazos y el máximo es 200.'],
    ['color fuera de la paleta', [trazo({ color: '#FF00FF' })], 'Trazo 1: el color "#FF00FF" no es de la paleta.'],
    ['color en minúsculas', [trazo({ color: '#1b2a7a' })], 'Trazo 1: el color "#1b2a7a" no es de la paleta.'],
    ['grosor muy fino', [trazo(), trazo({ width: 0.005 })], 'Trazo 2: el grosor tiene que estar entre 0,01 y 0,08.'],
    ['grosor muy grueso', [trazo({ width: 0.5 })], 'Trazo 1: el grosor tiene que estar entre 0,01 y 0,08.'],
    ['sin puntos', [trazo({ points: [] })], 'Trazo 1: no tiene puntos.'],
    ['x mayor que 1', [trazo({ points: [punto(1.01)] })], 'Trazo 1, punto 1: x tiene que estar entre 0 y 1.'],
    ['y negativa', [trazo({ points: [punto(0.5, 0), punto(0.5, -0.1, 5)] })], 'Trazo 1, punto 2: y tiene que estar entre 0 y 1.'],
    ['t negativo', [trazo({ points: [punto(0.5, 0.5, -1)] })], 'Trazo 1, punto 1: t tiene que ser un entero no negativo.'],
    ['t con decimales', [trazo({ points: [punto(0.5, 0.5, 1.5)] })], 'Trazo 1, punto 1: t tiene que ser un entero no negativo.'],
    ['t que va para atrás', [trazo({ points: [punto(0.1, 0.1, 50), punto(0.2, 0.2, 40)] })], 'Trazo 1, punto 2: t no puede ser menor que el del punto anterior.'],
    ['x como texto', [trazo({ points: [{ x: '0.5', y: 0.5, t: 0 }] })], 'Trazo 1, punto 1: x tiene que estar entre 0 y 1.'],
    ['punto con campos de más', [trazo({ points: [{ x: 0.5, y: 0.5, t: 0, p: 1 }] })], 'Trazo 1, punto 1: tiene que tener x, y y t.'],
    ['trazo con campos de más', [trazo({ opacidad: 1 })], 'Trazo 1: tiene campos de más (opacidad).'],
  ])('rechaza: %s', (_, trazos, mensaje) => {
    expect(problemaDelDibujo(trazos)).toBe(mensaje);
  });

  it('acepta 20.000 puntos y rechaza 20.001', () => {
    const conPuntos = (n: number) => [trazo({ points: Array.from({ length: n }, (_, i) => punto(0.5, 0.5, i)) })];
    expect(problemaDelDibujo(conPuntos(PUNTOS_MAXIMOS))).toBeNull();
    expect(problemaDelDibujo(conPuntos(PUNTOS_MAXIMOS + 1))).toBe('El dibujo tiene más de 20.000 puntos.');
  });

  it('el t es creciente dentro de cada trazo, no entre trazos', () => {
    expect(problemaDelDibujo([trazo({ points: [punto(0.1, 0.1, 500)] }), trazo({ points: [punto(0.1, 0.1, 10)] })])).toBeNull();
  });
});

describe('duracionDe', () => {
  it('es el t más alto', () => {
    expect(duracionDe([trazo(), { color: '#111111', width: 0.02, points: [punto(0, 0, 900), punto(0, 0, 1500)] }])).toBe(1500);
  });
});
