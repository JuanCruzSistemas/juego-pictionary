import { z } from 'zod';
import { normalizar } from '../comun/texto.js';

export const PALABRA_MAXIMA = 40;

/** Devuelve el problema de la palabra propia, o null si es válida. La web aplica las mismas reglas. */
export function problemaDeLaPalabra(palabra: string): string | null {
  if (palabra.trim().length === 0) return 'Escribí la palabra que vas a dibujar.';
  if (palabra !== palabra.trim()) return 'Sacá los espacios del principio y del final.';
  if ([...palabra].length > PALABRA_MAXIMA) return `Usá ${PALABRA_MAXIMA} caracteres como máximo.`;
  if (/\p{Cc}/u.test(palabra)) return 'La palabra tiene caracteres que no se pueden usar.';
  if (normalizar(palabra).length === 0) return 'La palabra necesita al menos una letra o un número.';
  return null;
}

/** Una de las opciones o una propia, nunca las dos ni ninguna. */
export const palabraSchema = z
  .strictObject(
    { opcion: z.string().optional(), propia: z.string().optional() },
    { error: 'Elegí una de las opciones o escribí la tuya.' },
  )
  .superRefine((body, ctx) => {
    const hayOpcion = body.opcion !== undefined;
    const hayPropia = body.propia !== undefined;
    if (hayOpcion === hayPropia) {
      ctx.addIssue({ code: 'custom', message: 'Elegí una de las opciones o escribí la tuya, no las dos.' });
      return;
    }
    if (hayPropia) {
      const problema = problemaDeLaPalabra(body.propia!);
      if (problema) ctx.addIssue({ code: 'custom', message: problema });
    }
  });

export type PalabraValidada = { opcion: string } | { propia: string };
