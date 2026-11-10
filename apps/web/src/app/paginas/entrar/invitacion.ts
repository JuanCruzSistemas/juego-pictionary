/** La invitación son 32 bytes en base64url: 43 caracteres de A-Z, a-z, 0-9, "-" y "_". */
const INVITACION = /^[A-Za-z0-9_-]{43}$/;

export type LecturaDeInvitacion = { invitacion: string } | { problema: string };

/**
 * Saca la invitación de lo que pegó la persona: el link completo (de cualquier dominio, por ejemplo
 * el de producción), el link sin "https://", o solo la invitación.
 */
export function leerInvitacion(texto: string): LecturaDeInvitacion {
  const limpio = texto.trim();
  if (!limpio) return { problema: 'Pegá el link que te pasaron.' };

  const enRuta = limpio.match(/\/s\/([^/?#\s]+)/);
  const candidata = enRuta ? enRuta[1] : limpio;
  if (INVITACION.test(candidata)) return { invitacion: candidata };

  if (enRuta || /^[A-Za-z0-9_-]+$/.test(candidata)) {
    return { problema: 'El link está incompleto. Copialo entero y probá de nuevo.' };
  }
  return { problema: 'Eso no parece un link de Garabato. Tiene que terminar en /s/ y un código largo.' };
}
