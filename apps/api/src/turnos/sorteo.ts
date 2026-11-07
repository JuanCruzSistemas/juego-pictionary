import { distanciaOSA, normalizar } from '../comun/texto.js';

export const CANTIDAD_DE_OPCIONES = 3;

/** Dos palabras se parecen si están a distancia 1 o una contiene a la otra: Gato/Pato, Flor/Florero. */
export function seParecen(a: string, b: string): boolean {
  const x = normalizar(a);
  const y = normalizar(b);
  return distanciaOSA(x, y) <= 1 || x.includes(y) || y.includes(x);
}

/**
 * Sortea opciones distintas que no se parezcan entre sí.
 * Si la lista no alcanza para evitar parecidos, completa con las que haya antes que ofrecer menos.
 */
export function sortearOpciones(
  palabras: readonly string[],
  azar: () => number = Math.random,
  cantidad = CANTIDAD_DE_OPCIONES,
): string[] {
  const mezcla = [...palabras];
  for (let i = mezcla.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [mezcla[i], mezcla[j]] = [mezcla[j], mezcla[i]];
  }

  const elegidas: string[] = [];
  for (const p of mezcla) {
    if (elegidas.length === cantidad) break;
    if (!elegidas.some((e) => seParecen(e, p))) elegidas.push(p);
  }
  for (const p of mezcla) {
    if (elegidas.length === cantidad) break;
    if (!elegidas.some((e) => normalizar(e) === normalizar(p))) elegidas.push(p);
  }
  return elegidas;
}
