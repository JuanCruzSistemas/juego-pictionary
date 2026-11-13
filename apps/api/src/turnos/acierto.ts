import { distanciaOSA, normalizar } from '../comun/texto.js';

const ARTICULOS = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'];

/** Normaliza y saca un artículo al principio: "El Mate" → "mate". Si no queda nada, no lo saca. */
export function sinArticulo(texto: string): string {
  const n = normalizar(texto);
  const [primera, ...resto] = n.split(' ');
  return ARTICULOS.includes(primera) && resto.length > 0 ? resto.join(' ') : n;
}

/** La forma y, si termina en "s" o "es", también sin eso: "flores" → flores, flore, flor. */
export function variantes(texto: string): string[] {
  const v = new Set([texto]);
  if (texto.length > 1 && texto.endsWith('s')) v.add(texto.slice(0, -1));
  if (texto.length > 2 && texto.endsWith('es')) v.add(texto.slice(0, -2));
  return [...v];
}

/** true si `a` y `b` difieren solo en dos letras contiguas intercambiadas. */
function esIntercambio(a: string, b: string): boolean {
  const x = [...a];
  const y = [...b];
  if (x.length !== y.length) return false;
  const distintas = x.flatMap((c, i) => (c !== y[i] ? [i] : []));
  return (
    distintas.length === 2 &&
    distintas[1] === distintas[0] + 1 &&
    x[distintas[0]] === y[distintas[1]] &&
    x[distintas[1]] === y[distintas[0]]
  );
}

/** Qué tan cerca tiene que estar una respuesta de una palabra de cierto largo. */
function seParece(respuesta: string, palabra: string): boolean {
  if (respuesta === palabra) return true;
  const largo = [...palabra].length;
  if (largo <= 4) return esIntercambio(respuesta, palabra);
  return distanciaOSA(respuesta, palabra) <= (largo <= 7 ? 1 : 2);
}

/**
 * ¿El texto contiene la palabra? Toda la palabra dentro del texto, o alguna de sus palabras
 * (o grupo de palabras seguidas) que la acertaría como respuesta: "mates ricos" contiene "Mate".
 */
export function contieneLaPalabra(texto: string, palabra: string): boolean {
  const t = normalizar(texto);
  const p = sinArticulo(palabra);
  if (p.length === 0) return false;
  if (` ${t} `.includes(` ${p} `)) return true;
  const palabras = t.split(' ');
  const largo = p.split(' ').length;
  // Grupos del mismo largo que la palabra, y de una más: "arco iris" contiene "Arcoíris".
  for (const n of [largo, largo + 1]) {
    for (let i = 0; i + n <= palabras.length; i++) {
      if (acierta(palabras.slice(i, i + n).join(' '), palabra)) return true;
    }
  }
  return false;
}

/**
 * ¿La respuesta acierta la palabra? Sin tildes ni mayúsculas, sin un artículo al principio,
 * aceptando una "s" o "es" de más en cualquiera de las dos, y con errores chicos según el largo
 * de la palabra: hasta 4 letras, solo un intercambio de dos letras contiguas; de 5 a 7, 1 error;
 * de 8 o más, 2.
 */
export function acierta(respuesta: string, palabra: string): boolean {
  const r = sinArticulo(respuesta);
  const p = sinArticulo(palabra);
  if (r.length === 0 || p.length === 0) return false;
  return variantes(r).some((vr) => variantes(p).some((vp) => seParece(vr, vp)));
}
