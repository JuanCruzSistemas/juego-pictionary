import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, type Observable } from 'rxjs';
import type { Estado, TurnoActual } from '@garabato/shared';
import { ApiService } from '../api/api.service';
import { EstadoService, INTERVALO_MS } from './estado.service';

describe('EstadoService', () => {
  let visibilidad: DocumentVisibilityState;
  let pedidos: number;
  let destruir: () => void;

  const ocultar = () => {
    visibilidad = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const mostrar = () => {
    visibilidad = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    visibilidad = 'visible';
    pedidos = 0;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilidad });

    const estado = { yo: { id: 'a', nombre: 'Juan', lugar: 1 } } as Estado;
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: { estado: () => (pedidos++, of(estado)) } }],
    });

    const alDestruir: (() => void)[] = [];
    destruir = () => alDestruir.forEach((f) => f());
    const ref = { onDestroy: (f: () => void) => alDestruir.push(f) } as unknown as DestroyRef;
    TestBed.inject(EstadoService).seguir(ref);
  });

  afterEach(() => {
    destruir();
    vi.useRealTimers();
  });

  it('pide el estado al empezar y después cada 5 s', () => {
    expect(pedidos).toBe(1);
    vi.advanceTimersByTime(INTERVALO_MS * 3);
    expect(pedidos).toBe(4);
  });

  it('con la pestaña oculta no pide nada', () => {
    ocultar();
    vi.advanceTimersByTime(INTERVALO_MS * 10);
    expect(pedidos).toBe(1);
  });

  it('al volver a estar visible pide en el acto y retoma el ritmo', () => {
    ocultar();
    vi.advanceTimersByTime(INTERVALO_MS * 2);
    mostrar();
    expect(pedidos).toBe(2);
    vi.advanceTimersByTime(INTERVALO_MS);
    expect(pedidos).toBe(3);
  });

  it('cuando nadie lo sigue, deja de pedir', () => {
    destruir();
    vi.advanceTimersByTime(INTERVALO_MS * 5);
    mostrar();
    expect(pedidos).toBe(1);
  });
});

describe('EstadoService.aplicarTurno', () => {
  it('descarta una respuesta que salió antes del cambio local', () => {
    const enCamino = new Subject<Estado>();
    let respuesta: Observable<Estado> = enCamino;
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { estado: () => respuesta } }] });
    const s = TestBed.inject(EstadoService);

    const viejo = (estado: TurnoActual['estado']) =>
      ({ yo: { id: 'j', nombre: 'Juan', lugar: 1 }, turno: { id: 't', estado } }) as Estado;
    respuesta = of(viejo('eligiendo'));
    s.actualizar();
    expect(s.estado()?.turno?.estado).toBe('eligiendo');

    respuesta = enCamino;
    s.actualizar(); // sale un pedido...
    s.aplicarTurno({ id: 't', numero: 1, rol: 'dibuja', estado: 'dibujando', intentos: 0, pistas: 0, palabra: 'Mate' });
    enCamino.next(viejo('eligiendo')); // ...y vuelve con el estado de antes de elegir
    enCamino.complete();
    expect(s.estado()?.turno).toMatchObject({ estado: 'dibujando', palabra: 'Mate' });

    respuesta = of(viejo('adivinando'));
    s.actualizar(); // los pedidos nuevos sí se aplican
    expect(s.estado()?.turno?.estado).toBe('adivinando');
  });
});
