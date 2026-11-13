import type { TurnoActual, TurnoAnterior } from '@garabato/shared';
import type { Turno } from '../generated/prisma/client.js';

/**
 * Arma lo que ve cada persona del turno en curso.
 * Es el único lugar que decide qué campos salen: quien adivina nunca recibe la palabra ni las opciones.
 */
export function vistaDelTurno(turno: Turno, jugadorId: string, intentos: number, pistas: number): TurnoActual {
  if (turno.estado === 'adivinado' || turno.estado === 'salteado' || turno.estado === 'rendido') {
    throw new Error(`El turno ${turno.id} está cerrado y no puede ser el actual.`);
  }
  const base = { id: turno.id, numero: turno.numero, estado: turno.estado, intentos, pistas };

  if (turno.dibujaId !== jugadorId) return { ...base, rol: 'adivina' };

  return {
    ...base,
    rol: 'dibuja',
    ...(turno.estado !== 'adivinando' && { opciones: turno.opciones }),
    ...(turno.palabra !== null && { palabra: turno.palabra }),
  };
}

export function vistaDelAnterior(turno: Turno | undefined, jugadorId: string): TurnoAnterior | null {
  if (!turno || (turno.estado !== 'adivinado' && turno.estado !== 'salteado' && turno.estado !== 'rendido')) return null;
  return { resultado: turno.estado, dibuje: turno.dibujaId === jugadorId };
}
