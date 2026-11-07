/** Colores del lienzo, de Lienzo.dc.html. */
export const COLORES = [
  { hex: '#1B2A7A', nombre: 'Azul birome' },
  { hex: '#111111', nombre: 'Negro' },
  { hex: '#D6293E', nombre: 'Rojo' },
  { hex: '#FFD400', nombre: 'Amarillo' },
  { hex: '#1E9E5A', nombre: 'Verde' },
  { hex: '#8A4B2A', nombre: 'Marrón' },
] as const;

/** Grosores relativos al lado del lienzo: en uno de 360 px, 3,6, 7,2 y 14,4 px. */
export const GROSORES = {
  fino: { valor: 0.01, nombre: 'Trazo fino', punto: 6 },
  medio: { valor: 0.02, nombre: 'Trazo medio', punto: 12 },
  grueso: { valor: 0.04, nombre: 'Trazo grueso', punto: 20 },
} as const;

export type Grosor = keyof typeof GROSORES;

/** La goma borra más ancho que el lápiz con el mismo grosor elegido. */
export const FACTOR_GOMA = 2;
