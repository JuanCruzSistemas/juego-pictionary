import type { Stroke } from '@garabato/shared';

/** Una pausa entre trazos más larga que esto se acorta: pensar qué dibujar no se reproduce. */
export const PAUSA_MAXIMA_MS = 600;
/** Un dibujo que tarda más que esto se acelera para entrar en este tiempo. */
export const DURACION_MAXIMA_MS = 15_000;

/**
 * Los tiempos para reproducir: cada pausa entre trazos se acorta a PAUSA_MAXIMA_MS como máximo,
 * y si el total pasa DURACION_MAXIMA_MS, todo se acelera parejo. Dentro de un trazo el ritmo
 * es el real (o acelerado), así se ve cómo se dibujó.
 */
export function tiemposDeReproduccion(trazos: readonly Stroke[]): Stroke[] {
  let corrimiento = 0;
  let finAnterior: number | null = null;
  const comprimidos = trazos.map((trazo) => {
    const inicio = trazo.points[0]?.t ?? 0;
    if (finAnterior !== null) {
      const pausa = inicio - finAnterior;
      if (pausa > PAUSA_MAXIMA_MS) corrimiento += pausa - PAUSA_MAXIMA_MS;
    }
    finAnterior = Math.max(finAnterior ?? 0, trazo.points.at(-1)?.t ?? inicio);
    return { ...trazo, points: trazo.points.map((p) => ({ ...p, t: Math.max(0, p.t - corrimiento) })) };
  });
  const total = duracion(comprimidos);
  if (total <= DURACION_MAXIMA_MS) return comprimidos;
  const factor = DURACION_MAXIMA_MS / total;
  return comprimidos.map((trazo) => ({ ...trazo, points: trazo.points.map((p) => ({ ...p, t: Math.round(p.t * factor) })) }));
}

/** El t del último punto. */
export function duracion(trazos: readonly Stroke[]): number {
  return Math.max(0, ...trazos.map((t) => t.points.at(-1)?.t ?? 0));
}

/** Lo dibujado hasta el instante `t`: los trazos que ya empezaron, cada uno con sus puntos hasta `t`. */
export function trazosHasta(trazos: readonly Stroke[], t: number): Stroke[] {
  const hasta: Stroke[] = [];
  for (const trazo of trazos) {
    const puntos = trazo.points.filter((p) => p.t <= t);
    if (puntos.length === 0) continue;
    hasta.push(puntos.length === trazo.points.length ? trazo : { ...trazo, points: puntos });
  }
  return hasta;
}
