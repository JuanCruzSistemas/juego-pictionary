import { createHash, randomBytes } from 'node:crypto';

/** Token aleatorio de 32 bytes en base64url. Sirve para invitaciones y sesiones. */
export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

/** En la base solo se guarda el hash de la sesión. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
