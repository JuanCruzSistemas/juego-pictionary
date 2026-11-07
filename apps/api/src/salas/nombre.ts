import { z } from 'zod';

export const NOMBRE_MAXIMO = 30;

/** Devuelve el problema del nombre, o null si es válido. La web aplica las mismas reglas. */
export function problemaDelNombre(nombre: string): string | null {
  if (nombre.trim().length === 0) return 'Escribí tu nombre o apodo.';
  if (nombre !== nombre.trim()) return 'Sacá los espacios del principio y del final.';
  if ([...nombre].length > NOMBRE_MAXIMO) return `Usá ${NOMBRE_MAXIMO} caracteres como máximo.`;
  if (/\p{Cc}/u.test(nombre)) return 'El nombre tiene caracteres que no se pueden usar.';
  return null;
}

export const entrarSchema = z.object({
  nombre: z.string({ error: 'Escribí tu nombre o apodo.' }).superRefine((nombre, ctx) => {
    const problema = problemaDelNombre(nombre);
    if (problema) ctx.addIssue({ code: 'custom', message: problema });
  }),
});
