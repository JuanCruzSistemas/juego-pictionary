import { z } from 'zod';
import { normalizar } from '../comun/texto.js';

export const RESPUESTA_MAXIMA = 60;

export const intentoSchema = z.strictObject(
  {
    texto: z
      .string({ error: 'Escribí una respuesta.' })
      .transform((t) => t.trim())
      .superRefine((t, ctx) => {
        if (normalizar(t).length === 0) ctx.addIssue({ code: 'custom', message: 'Escribí una respuesta con letras o números.' });
        else if ([...t].length > RESPUESTA_MAXIMA) ctx.addIssue({ code: 'custom', message: `Usá ${RESPUESTA_MAXIMA} caracteres como máximo.` });
        else if (/\p{Cc}/u.test(t)) ctx.addIssue({ code: 'custom', message: 'La respuesta tiene caracteres que no se pueden usar.' });
      }),
  },
  { error: 'Escribí una respuesta.' },
);
