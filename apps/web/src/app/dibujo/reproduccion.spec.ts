import type { Stroke } from '@garabato/shared';
import { DURACION_MAXIMA_MS, PAUSA_MAXIMA_MS, duracion, tiemposDeReproduccion, trazosHasta } from './reproduccion';

const trazo = (...ts: number[]): Stroke => ({ color: '#1B2A7A', width: 0.02, points: ts.map((t, i) => ({ x: i / 10, y: 0.5, t })) });
const tiempos = (ts: Stroke[]) => ts.map((t) => t.points.map((p) => p.t));

describe('tiemposDeReproduccion', () => {
  it('deja igual un dibujo con pausas cortas', () => {
    const d = [trazo(0, 100), trazo(300, 400)];
    expect(tiemposDeReproduccion(d)).toEqual(d);
  });

  it('acorta las pausas largas entre trazos, sin tocar el ritmo de cada trazo', () => {
    const d = [trazo(0, 100), trazo(10_100, 10_300), trazo(10_400)];
    expect(tiempos(tiemposDeReproduccion(d))).toEqual([[0, 100], [100 + PAUSA_MAXIMA_MS, 300 + PAUSA_MAXIMA_MS], [400 + PAUSA_MAXIMA_MS]]);
  });

  it('acelera parejo un dibujo muy largo', () => {
    const d = [trazo(0, 30_000)];
    expect(duracion(tiemposDeReproduccion(d))).toBe(DURACION_MAXIMA_MS);
  });
});

describe('trazosHasta', () => {
  const d = [trazo(0, 100, 200), trazo(300, 400)];

  it('al principio, solo el primer punto', () => {
    expect(tiempos(trazosHasta(d, 0))).toEqual([[0]]);
  });

  it('a mitad, el primer trazo entero y el segundo cortado', () => {
    expect(tiempos(trazosHasta(d, 350))).toEqual([[0, 100, 200], [300]]);
  });

  it('al final, todo', () => {
    expect(trazosHasta(d, 400)).toEqual(d);
  });
});
