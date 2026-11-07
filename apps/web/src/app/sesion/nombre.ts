/** Mismas reglas que apps/api/src/salas/nombre.ts. */
export const NOMBRE_MAXIMO = 30;

export function problemaDelNombre(nombre: string): string | null {
  if (nombre.trim().length === 0) return 'Escribí tu nombre o apodo.';
  if (nombre !== nombre.trim()) return 'Sacá los espacios del principio y del final.';
  if ([...nombre].length > NOMBRE_MAXIMO) return `Usá ${NOMBRE_MAXIMO} caracteres como máximo.`;
  if (/\p{Cc}/u.test(nombre)) return 'El nombre tiene caracteres que no se pueden usar.';
  return null;
}
