import type { Salteos } from '@garabato/shared';

/** Mismas reglas que apps/api/src/turnos/palabra.ts. */
export const PALABRA_MAXIMA = 40;

export function problemaDeLaPalabra(palabra: string): string | null {
  if (palabra.trim().length === 0) return 'Escribí la palabra que vas a dibujar.';
  if (palabra !== palabra.trim()) return 'Sacá los espacios del principio y del final.';
  if ([...palabra].length > PALABRA_MAXIMA) return `Usá ${PALABRA_MAXIMA} caracteres como máximo.`;
  if (/\p{Cc}/u.test(palabra)) return 'La palabra tiene caracteres que no se pueden usar.';
  if (!/[\p{L}\p{N}]/u.test(palabra)) return 'La palabra necesita al menos una letra o un número.';
  return null;
}

const hora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Textos del contador de salteos de Elegir.dc.html. */
export function textoDeSalteos(s: Salteos, formatear: (d: Date) => string = (d) => hora.format(d)) {
  return {
    titulo: `Te quedan ${s.quedan} de ${s.maximo}`,
    detalle:
      s.quedan < s.maximo && s.proximoEn
        ? `Vuelve uno a las ${formatear(new Date(s.proximoEn))}`
        : 'Se renuevan cada media hora',
  };
}
