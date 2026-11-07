import { StandardSchemaValidationPipe } from '@nestjs/common';
import { datosInvalidos } from './errores.js';

/** Valida los @Body({ schema }) con Zod y responde con el primer mensaje, en castellano. */
export const pipeDeValidacion = new StandardSchemaValidationPipe({
  exceptionFactory: (issues) => datosInvalidos(issues[0]?.message ?? 'Los datos no son válidos.'),
});
