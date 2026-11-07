import type { Stroke, StrokePoint } from '@garabato/shared';

/** Puntos más cerca que esto del anterior se descartan: no cambian el dibujo y engordan el envío. */
export const DISTANCIA_MINIMA = 0.003;
export const DECIMALES = 4;

/** Color de la hoja: la goma es un trazo de este color. */
export const COLOR_HOJA = '#FFFFFF';

export function redondear(n: number): number {
  const f = 10 ** DECIMALES;
  return Math.round(n * f) / f;
}

const entre0y1 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Pasa una posición de pantalla a coordenadas del lienzo de 0 a 1, redondeadas a 4 decimales.
 * Fuera del lienzo se recorta al borde. `t` son ms enteros desde el primer punto del dibujo.
 */
export function normalizarPunto(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  t: number,
): StrokePoint {
  return {
    x: redondear(entre0y1((clientX - rect.left) / rect.width)),
    y: redondear(entre0y1((clientY - rect.top) / rect.height)),
    t: Math.max(0, Math.round(t)),
  };
}

/** Distancia entre dos puntos en coordenadas del lienzo. */
export function distancia(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Suma el punto si está a DISTANCIA_MINIMA o más del último. El primero siempre entra.
 * Devuelve true si lo sumó.
 */
export function agregarPunto(puntos: StrokePoint[], p: StrokePoint): boolean {
  const ultimo = puntos.at(-1);
  if (ultimo && distancia(ultimo, p) < DISTANCIA_MINIMA) return false;
  puntos.push(p);
  return true;
}

/**
 * Cierra el trazo con el punto donde se levantó el dedo, aunque esté cerca del último,
 * para que el final no quede corto. No lo repite si es el mismo lugar.
 */
export function cerrarTrazo(puntos: StrokePoint[], final: StrokePoint): void {
  const ultimo = puntos.at(-1);
  if (!ultimo || ultimo.x !== final.x || ultimo.y !== final.y) puntos.push(final);
}

/** Saca el último trazo completo. */
export function deshacer(trazos: readonly Stroke[]): Stroke[] {
  return trazos.slice(0, -1);
}

/**
 * Pinta los trazos en un contexto cuyo sistema de coordenadas mide `lado` × `lado`.
 * Suaviza con curvas cuadráticas entre los puntos medios: cada punto hace de control
 * y la curva pasa por el medio entre ese punto y el siguiente.
 */
export function pintarTrazos(ctx: CanvasRenderingContext2D, trazos: readonly Stroke[], lado: number): void {
  for (const trazo of trazos) pintarTrazo(ctx, trazo, lado);
}

export function pintarTrazo(ctx: CanvasRenderingContext2D, trazo: Stroke, lado: number): void {
  const pts = trazo.points;
  if (pts.length === 0) return;
  const ancho = Math.max(1, trazo.width * lado);
  ctx.strokeStyle = trazo.color;
  ctx.fillStyle = trazo.color;
  ctx.lineWidth = ancho;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const X = (p: StrokePoint) => p.x * lado;
  const Y = (p: StrokePoint) => p.y * lado;

  // Un toque sin movimiento: un punto.
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(X(pts[0]), Y(pts[0]), ancho / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(X(pts[0]), Y(pts[0]));
  if (pts.length === 2) {
    ctx.lineTo(X(pts[1]), Y(pts[1]));
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const medioX = (X(pts[i]) + X(pts[i + 1])) / 2;
      const medioY = (Y(pts[i]) + Y(pts[i + 1])) / 2;
      ctx.quadraticCurveTo(X(pts[i]), Y(pts[i]), medioX, medioY);
    }
    const ultimo = pts[pts.length - 1];
    ctx.lineTo(X(ultimo), Y(ultimo));
  }
  ctx.stroke();
}
