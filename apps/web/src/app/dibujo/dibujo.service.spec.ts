import { TestBed } from '@angular/core/testing';
import type { Stroke } from '@garabato/shared';
import { DibujoService } from './dibujo.service';

const trazo = (...ts: number[]): Stroke => ({
  color: '#1B2A7A',
  width: 0.02,
  points: ts.map((t, i) => ({ x: i / 10, y: 0.5, t })),
});

describe('DibujoService', () => {
  let d: DibujoService;
  beforeEach(() => (d = TestBed.inject(DibujoService)));

  it('t es en ms enteros desde el primer punto del dibujo', () => {
    expect(d.tiempo(5000.4)).toBe(0);
    expect(d.tiempo(5250.6)).toBe(250);
    expect(d.tiempo(9000)).toBe(4000);
  });

  it('deshacer saca el último trazo completo', () => {
    d.agregar(trazo(0, 10));
    d.agregar(trazo(20, 30, 40));
    d.deshacer();
    expect(d.trazos()).toEqual([trazo(0, 10)]);
  });

  it('si deshacer o borrar todo lo dejan vacío, el próximo trazo empieza en t = 0', () => {
    d.tiempo(1000);
    d.agregar(trazo(0, 10));
    d.deshacer();
    expect(d.tiempo(8000)).toBe(0);

    d.agregar(trazo(0));
    d.borrarTodo();
    expect(d.vacio()).toBe(true);
    expect(d.tiempo(12000)).toBe(0);
  });

  it('paraEnviar devuelve los trazos y la duración', () => {
    d.agregar(trazo(0, 100));
    d.agregar(trazo(900, 1500));
    expect(d.paraEnviar()).toEqual({ trazos: [trazo(0, 100), trazo(900, 1500)], duracionMs: 1500 });
    expect(d.cantidadDePuntos()).toBe(4);
  });

  it('cambiar de turno vacía el dibujo; el mismo turno lo conserva', () => {
    d.usarTurno('t1');
    d.agregar(trazo(0));
    d.usarTurno('t1');
    expect(d.vacio()).toBe(false);
    d.usarTurno('t2');
    expect(d.vacio()).toBe(true);
  });

  it('ignora trazos sin puntos', () => {
    d.agregar({ color: '#111111', width: 0.02, points: [] });
    expect(d.vacio()).toBe(true);
  });
});
