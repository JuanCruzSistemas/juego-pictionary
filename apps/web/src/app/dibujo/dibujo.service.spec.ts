import { TestBed } from '@angular/core/testing';
import type { Stroke } from '@garabato/shared';
import { ALMACEN, almacenEnMemoria } from '../comun/almacen';
import { CLAVE_BORRADOR, CLAVE_BORRADOR_LIBRE, DibujoLibreService, DibujoService, ID_LIBRE } from './dibujo.service';

const trazo = (...ts: number[]): Stroke => ({
  color: '#1B2A7A',
  width: 0.02,
  points: ts.map((t, i) => ({ x: i / 10, y: 0.5, t })),
});

describe('DibujoService', () => {
  let almacen: ReturnType<typeof almacenEnMemoria>;
  let d: DibujoService;

  /** Simula cerrar y volver a abrir la app: un servicio nuevo con el mismo almacenamiento. */
  const reabrir = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ALMACEN, useValue: almacen }] });
    return TestBed.inject(DibujoService);
  };

  beforeEach(() => {
    almacen = almacenEnMemoria();
    d = reabrir();
  });

  it('t es en ms enteros desde el primer punto del dibujo', () => {
    expect(d.tiempo(5000.4)).toBe(0);
    expect(d.tiempo(5250.6)).toBe(250);
    expect(d.tiempo(9000)).toBe(4000);
  });

  it('deshacer saca el último trazo completo', () => {
    d.usarTurno('t1');
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

  it('paraEnviar devuelve los trazos; la duración queda aparte', () => {
    d.agregar(trazo(0, 100));
    d.agregar(trazo(900, 1500));
    expect(d.paraEnviar()).toEqual({ trazos: [trazo(0, 100), trazo(900, 1500)] });
    expect(d.duracionMs()).toBe(1500);
    expect(d.cantidadDePuntos()).toBe(4);
  });

  it('ignora trazos sin puntos', () => {
    d.agregar({ color: '#111111', width: 0.02, points: [] });
    expect(d.vacio()).toBe(true);
  });

  describe('borrador', () => {
    it('al cerrar y volver a abrir la app, el dibujo del mismo turno sigue ahí', () => {
      d.usarTurno('t1');
      d.agregar(trazo(0, 100));
      d.agregar(trazo(400, 700));

      const otraVez = reabrir();
      otraVez.usarTurno('t1');
      expect(otraVez.trazos()).toEqual([trazo(0, 100), trazo(400, 700)]);
    });

    it('al retomar, el próximo trazo sigue después del último, no vuelve a t = 0', () => {
      d.usarTurno('t1');
      d.agregar(trazo(0, 700));
      const otraVez = reabrir();
      otraVez.usarTurno('t1');
      expect(otraVez.tiempo(50_000)).toBe(1200); // 700 + 500 de pausa
      expect(otraVez.tiempo(50_100)).toBe(1300);
    });

    it('deshacer también queda guardado', () => {
      d.usarTurno('t1');
      d.agregar(trazo(0));
      d.agregar(trazo(10));
      d.deshacer();
      const otraVez = reabrir();
      otraVez.usarTurno('t1');
      expect(otraVez.trazos()).toEqual([trazo(0)]);
    });

    it('el borrador de otro turno no se recupera y se borra', () => {
      d.usarTurno('t1');
      d.agregar(trazo(0));
      const otraVez = reabrir();
      otraVez.usarTurno('t2');
      expect(otraVez.vacio()).toBe(true);
      expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(false);
    });

    it('borrar todo (y mandar, que borra todo) elimina el borrador', () => {
      d.usarTurno('t1');
      d.agregar(trazo(0));
      d.borrarTodo();
      expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(false);
    });

    it('descartarSiNoEs borra el borrador cuando el turno cambió, y lo deja si es el mismo', () => {
      d.usarTurno('t1');
      d.agregar(trazo(0));
      d.descartarSiNoEs('t1');
      expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(true);
      d.descartarSiNoEs('t2');
      expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(false);
      expect(d.vacio()).toBe(true);
    });

    it('un borrador roto se ignora', () => {
      almacen.datos.set(CLAVE_BORRADOR, '{no es json');
      const otraVez = reabrir();
      otraVez.usarTurno('t1');
      expect(otraVez.vacio()).toBe(true);
    });
  });

  describe('dibujo libre', () => {
    it('tiene su propio borrador: no pisa ni borra el del turno', () => {
      d.usarTurno('t1');
      d.agregar(trazo(0, 10));
      const libre = TestBed.inject(DibujoLibreService);
      libre.usarTurno(ID_LIBRE);
      expect(libre.vacio()).toBe(true);
      libre.agregar(trazo(5));
      expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(true);
      expect(almacen.datos.has(CLAVE_BORRADOR_LIBRE)).toBe(true);

      // Inicio descarta el borrador de un turno viejo: el libre queda.
      d.descartarSiNoEs('t2');
      expect(almacen.datos.has(CLAVE_BORRADOR)).toBe(false);
      expect(almacen.datos.has(CLAVE_BORRADOR_LIBRE)).toBe(true);
    });

    it('se recupera al volver a abrir la app', () => {
      const libre = TestBed.inject(DibujoLibreService);
      libre.usarTurno(ID_LIBRE);
      libre.agregar(trazo(0, 10));
      reabrir();
      const otraVez = TestBed.inject(DibujoLibreService);
      otraVez.usarTurno(ID_LIBRE);
      expect(otraVez.trazos()).toEqual([trazo(0, 10)]);
    });
  });
});
