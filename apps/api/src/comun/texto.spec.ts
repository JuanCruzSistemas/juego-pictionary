import { distanciaOSA, normalizar } from './texto.js';

describe('normalizar', () => {
  it.each([
    ['MATÉ', 'mate'],
    ['  ¡Mate!  ', 'mate'],
    ['Pingüino', 'pinguino'],
    ['Arco   iris', 'arco iris'],
    ['Año', 'año'],
    ['Choripán', 'choripan'],
  ])('%j → %j', (entrada, salida) => {
    expect(normalizar(entrada)).toBe(salida);
  });
});

describe('distanciaOSA', () => {
  it.each([
    ['mate', 'mate', 0],
    ['maet', 'mate', 1], // intercambio contiguo
    ['gato', 'pato', 1], // sustitución
    ['flor', 'florero', 3], // inserciones
    ['mate', 'mte', 1], // borrado
    ['ca', 'abc', 3], // OSA no reusa una subcadena intercambiada
    ['', 'sol', 3],
  ])('%j y %j: %i', (a, b, d) => {
    expect(distanciaOSA(a, b)).toBe(d);
    expect(distanciaOSA(b, a)).toBe(d);
  });
});
