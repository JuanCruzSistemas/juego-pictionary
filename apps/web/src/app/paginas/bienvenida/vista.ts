import type { SalaPublica } from '@garabato/shared';

export type Vista =
  | 'cargando'
  | 'formulario'
  | 'llena'
  | 'no-encontrada'
  | 'sin-conexion'
  /** Hay sesión de otra sala y en esta hay lugar: se puede ir a la propia o entrar a esta. */
  | 'otra-sala'
  /** Hay sesión de otra sala y esta está completa: solo se puede ir a la propia. */
  | 'otra-sala-llena';

/**
 * Qué muestra Bienvenida. `invitacionDeLaSesion` es undefined si no hay sesión en el dispositivo.
 * Si la sesión es de esta misma sala, Bienvenida redirige al inicio antes de llegar acá.
 */
export function vistaDeBienvenida(sala: SalaPublica, invitacionDeLaSesion: string | undefined): Vista {
  const deOtraSala = invitacionDeLaSesion !== undefined;
  if (sala.llena) return deOtraSala ? 'otra-sala-llena' : 'llena';
  return deOtraSala ? 'otra-sala' : 'formulario';
}
