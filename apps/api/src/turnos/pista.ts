import { z } from 'zod';
import { normalizar } from '../comun/texto.js';

export const PISTA_MAXIMA = 80;

/** Body de POST /api/turnos/:id/pistas. Igual que una respuesta, con un poco más de largo. */
export const pistaSchema = z.strictObject(
  {
    texto: z
      .string({ error: 'Escribí una pista.' })
      .transform((t) => t.trim())
      .superRefine((t, ctx) => {
        if (normalizar(t).length === 0) ctx.addIssue({ code: 'custom', message: 'Escribí una pista con letras o números.' });
        else if ([...t].length > PISTA_MAXIMA) ctx.addIssue({ code: 'custom', message: `Usá ${PISTA_MAXIMA} caracteres como máximo.` });
        else if (/\p{Cc}/u.test(t)) ctx.addIssue({ code: 'custom', message: 'La pista tiene caracteres que no se pueden usar.' });
      }),
  },
  { error: 'Escribí una pista.' },
);
