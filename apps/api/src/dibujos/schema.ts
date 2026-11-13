import { z } from 'zod';
import type { Stroke } from '@garabato/shared';
import { problemaDelDibujo } from './reglas.js';

/** Body de POST /api/turnos/:id/dibujo y POST /api/libres: solo `{ trazos }`, revisados por problemaDelDibujo. */
export const dibujoSchema = z
  .strictObject({ trazos: z.unknown() }, { error: 'Falta el dibujo.' })
  .superRefine((body, ctx) => {
    const problema = problemaDelDibujo(body.trazos);
    if (problema) ctx.addIssue({ code: 'custom', message: problema });
  })
  .transform((body) => ({ trazos: body.trazos as Stroke[] }));
