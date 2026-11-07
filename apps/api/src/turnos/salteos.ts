import type { Salteos } from '@garabato/shared';

export const MAXIMO_DE_SALTEOS = 3;
/** Cada salteo vuelve 30 minutos después de usado. */
export const RENOVACION_MS = 30 * 60 * 1000;

/** Desde cuándo cuentan los salteos que todavía no volvieron. */
export function inicioDeLaVentana(ahora: Date): Date {
  return new Date(ahora.getTime() - RENOVACION_MS);
}

/**
 * Cuántos salteos quedan según cuándo se usaron. Uno usado a las 10:00 cuenta hasta las 10:29:59.999
 * y a las 10:30 ya volvió.
 */
export function contarSalteos(usos: readonly Date[], ahora: Date): Salteos {
  const desde = inicioDeLaVentana(ahora).getTime();
  const vigentes = usos.map((u) => u.getTime()).filter((t) => t > desde);
  const quedan = Math.max(0, MAXIMO_DE_SALTEOS - vigentes.length);
  const proximo = vigentes.length > 0 ? Math.min(...vigentes) + RENOVACION_MS : null;
  return {
    quedan,
    maximo: MAXIMO_DE_SALTEOS,
    proximoEn: proximo === null ? null : new Date(proximo).toISOString(),
  };
}
