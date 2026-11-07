import { normalizar } from './texto';

describe('normalizar (igual que en la API)', () => {
  it.each([
    ['MATÉ', 'mate'],
    ['  ¡Café!  ', 'cafe'],
    ['Pingüino', 'pinguino'],
    ['Año', 'año'],
    ['¡¿?!', ''],
  ])('%j → %j', (a, b) => expect(normalizar(a)).toBe(b));
});
