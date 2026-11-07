/**
 * Tipos compartidos entre apps/web y apps/api.
 * Este paquete solo tiene declaraciones: importalo siempre con `import type`.
 */

/** Un punto del trazo. `x` e `y` van de 0 a 1; `t` son milisegundos desde el inicio del dibujo. */
export type StrokePoint = { x: number; y: number; t: number };

/** Un trazo. `width` es relativo al lado del lienzo cuadrado. */
export type Stroke = {
  color: string;
  width: number;
  points: StrokePoint[];
};

/** Respuesta de GET /health. */
export type Health = { ok: true };
