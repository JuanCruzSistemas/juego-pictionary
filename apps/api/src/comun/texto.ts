/**
 * Normaliza para comparar: sin tildes, en minúsculas, sin puntuación y con los espacios juntados.
 * "¡MATÉ!" y "mate" quedan iguales. La ñ se conserva, para no confundir "año" con "ano".
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

/**
 * Distancia de Damerau-Levenshtein en su variante OSA: inserción, borrado, sustitución
 * o intercambio de dos letras contiguas, cada uno cuenta 1. Compara por caracteres, no por UTF-16.
 */
export function distanciaOSA(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const costo = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[x.length][y.length];
}
