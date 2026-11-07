/**
 * Igual que apps/api/src/comun/texto.ts: sin tildes, en minúsculas, sin puntuación y con los
 * espacios juntados. La ñ se conserva.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/ñ/gi, (m) => (m[0] === 'N' ? 'Ñ' : 'ñ'))
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
