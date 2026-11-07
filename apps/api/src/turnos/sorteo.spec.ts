import { PALABRAS_BASE } from '../../prisma/palabras-base.js';
import { seParecen, sortearOpciones } from './sorteo.js';

/** Generador determinístico para que los tests no dependan de la suerte. */
function azarConSemilla(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

describe('seParecen', () => {
  it.each([
    ['Gato', 'Pato'],
    ['Flor', 'Florero'],
    ['Florero', 'Flor'],
    ['Mate', 'Maet'],
    ['Sol', 'sol'],
    ['Pan', 'Pantalla'],
  ])('%s y %s se parecen', (a, b) => {
    expect(seParecen(a, b)).toBe(true);
  });

  it.each([
    ['Mate', 'Termo'],
    ['Gato', 'Perro'],
    ['Luna', 'Sol'],
  ])('%s y %s no se parecen', (a, b) => {
    expect(seParecen(a, b)).toBe(false);
  });
});

describe('sortearOpciones', () => {
  it('nunca junta palabras parecidas, aunque la lista esté llena de ellas', () => {
    const lista = ['Gato', 'Pato', 'Rato', 'Flor', 'Florero', 'Sol', 'Luna', 'Mate'];
    for (let semilla = 0; semilla < 500; semilla++) {
      const opciones = sortearOpciones(lista, azarConSemilla(semilla));
      expect(opciones).toHaveLength(3);
      for (let i = 0; i < opciones.length; i++) {
        for (let j = i + 1; j < opciones.length; j++) {
          expect(seParecen(opciones[i], opciones[j]), opciones.join(', ')).toBe(false);
        }
      }
    }
  });

  it('con la lista base siempre da 3 palabras distintas y sin parecidos', () => {
    for (let semilla = 0; semilla < 500; semilla++) {
      const [a, b, c] = sortearOpciones(PALABRAS_BASE, azarConSemilla(semilla));
      expect(seParecen(a, b) || seParecen(a, c) || seParecen(b, c)).toBe(false);
    }
  });

  it('si no alcanza para evitar parecidos, completa igual con palabras distintas', () => {
    const opciones = sortearOpciones(['Gato', 'Pato', 'Rato'], azarConSemilla(1));
    expect(new Set(opciones).size).toBe(3);
  });
});
