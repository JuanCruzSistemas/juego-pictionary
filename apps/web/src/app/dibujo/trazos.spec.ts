import type { Stroke, StrokePoint } from '@garabato/shared';
import {
  DISTANCIA_MINIMA,
  agregarPunto,
  cerrarTrazo,
  deshacer,
  normalizarPunto,
  pintarTrazo,
  redondear,
} from './trazos';

const rect = { left: 10, top: 100, width: 300, height: 300 };

describe('normalizarPunto', () => {
  it('pasa la posición en pantalla a 0..1 respecto del lienzo', () => {
    expect(normalizarPunto(10, 100, rect, 0)).toEqual({ x: 0, y: 0, t: 0 });
    expect(normalizarPunto(310, 400, rect, 0)).toEqual({ x: 1, y: 1, t: 0 });
    expect(normalizarPunto(160, 175, rect, 0)).toEqual({ x: 0.5, y: 0.25, t: 0 });
  });

  it('recorta al borde lo que cae fuera del lienzo', () => {
    expect(normalizarPunto(-50, 9999, rect, 0)).toMatchObject({ x: 0, y: 1 });
  });

  it('redondea x e y a 4 decimales y t a ms enteros', () => {
    const p = normalizarPunto(10 + 100, 100 + 200, rect, 1234.6);
    expect(p).toEqual({ x: 0.3333, y: 0.6667, t: 1235 });
  });
});

describe('redondear', () => {
  it.each([
    [0.123456, 0.1235],
    [0.99999, 1],
    [0.00004, 0],
    [0.5, 0.5],
  ])('%f → %f', (a, b) => expect(redondear(a)).toBe(b));
});

describe('agregarPunto', () => {
  const p = (x: number, y: number, t = 0): StrokePoint => ({ x, y, t });

  it('el primer punto siempre entra', () => {
    const pts: StrokePoint[] = [];
    expect(agregarPunto(pts, p(0.5, 0.5))).toBe(true);
    expect(pts).toHaveLength(1);
  });

  it('descarta los que están a menos de 0,003 del último', () => {
    const pts = [p(0.5, 0.5)];
    expect(agregarPunto(pts, p(0.502, 0.5))).toBe(false);
    expect(agregarPunto(pts, p(0.5, 0.5029))).toBe(false);
    expect(agregarPunto(pts, p(0.502, 0.502))).toBe(false); // ~0,00283
    expect(pts).toHaveLength(1);
  });

  it('suma los que están a 0,003 o más', () => {
    const pts = [p(0.5, 0.5)];
    expect(agregarPunto(pts, p(0.5 + DISTANCIA_MINIMA, 0.5))).toBe(true);
    expect(agregarPunto(pts, p(0.51, 0.51))).toBe(true);
    expect(pts).toHaveLength(3);
  });

  it('compara con el último sumado, no con el último recibido', () => {
    const pts = [p(0.5, 0.5)];
    // Pasitos de 0,002: cada uno solo no alcanza, pero se acumulan contra el último guardado.
    for (const x of [0.502, 0.504, 0.506]) agregarPunto(pts, p(x, 0.5));
    expect(pts.map((q) => q.x)).toEqual([0.5, 0.504]);
  });
});

describe('cerrarTrazo', () => {
  it('agrega el punto final aunque esté cerca, para que el trazo no quede corto', () => {
    const pts = [{ x: 0.5, y: 0.5, t: 0 }];
    cerrarTrazo(pts, { x: 0.501, y: 0.5, t: 20 });
    expect(pts).toHaveLength(2);
  });

  it('no lo repite si es el mismo lugar', () => {
    const pts = [{ x: 0.5, y: 0.5, t: 0 }];
    cerrarTrazo(pts, { x: 0.5, y: 0.5, t: 20 });
    expect(pts).toHaveLength(1);
  });
});

describe('deshacer', () => {
  const trazo = (color: string): Stroke => ({ color, width: 0.02, points: [{ x: 0, y: 0, t: 0 }] });

  it('saca el último trazo completo', () => {
    const trazos = [trazo('#1B2A7A'), trazo('#D6293E'), trazo('#FFFFFF')];
    expect(deshacer(trazos).map((t) => t.color)).toEqual(['#1B2A7A', '#D6293E']);
    expect(trazos).toHaveLength(3); // no modifica el original
  });

  it('sin trazos no hace nada', () => {
    expect(deshacer([])).toEqual([]);
  });
});

describe('pintarTrazo', () => {
  function ctxFalso() {
    const llamadas: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k: string) => (k in ctxProps ? ctxProps[k] : (...a: unknown[]) => llamadas.push(`${k}(${a.join(',')})`)),
      set: (_, k: string, v) => ((ctxProps[k] = v), true),
    });
    const ctxProps: Record<string, unknown> = {};
    return { ctx: ctx as unknown as CanvasRenderingContext2D, llamadas, props: ctxProps };
  }

  it('suaviza con curvas cuadráticas entre los puntos medios', () => {
    const { ctx, llamadas } = ctxFalso();
    const pts = [
      { x: 0, y: 0, t: 0 },
      { x: 0.5, y: 0, t: 1 },
      { x: 0.5, y: 0.5, t: 2 },
      { x: 1, y: 0.5, t: 3 },
    ];
    pintarTrazo(ctx, { color: '#111111', width: 0.02, points: pts }, 100);
    expect(llamadas).toEqual([
      'beginPath()',
      'moveTo(0,0)',
      'quadraticCurveTo(50,0,50,25)',
      'quadraticCurveTo(50,50,75,50)',
      'lineTo(100,50)',
      'stroke()',
    ]);
  });

  it('el grosor es relativo al lado del lienzo', () => {
    const { ctx, props } = ctxFalso();
    const t = { color: '#111111', width: 0.02, points: [{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 1 }] };
    pintarTrazo(ctx, t, 300);
    expect(props['lineWidth']).toBe(6);
    pintarTrazo(ctx, t, 600);
    expect(props['lineWidth']).toBe(12);
  });

  it('un toque sin movimiento pinta un punto', () => {
    const { ctx, llamadas } = ctxFalso();
    pintarTrazo(ctx, { color: '#111111', width: 0.02, points: [{ x: 0.5, y: 0.5, t: 0 }] }, 100);
    expect(llamadas.some((l) => l.startsWith('arc(50,50,1'))).toBe(true);
    expect(llamadas).toContain('fill()');
  });
});
