import { PALABRAS_BASE } from '../../prisma/palabras-base.js';
import { seParecen, sortearOpciones, sortearConPropias } from './sorteo.js';

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

describe('sortearConPropias', () => {
  const base = ['Mate', 'Bicicleta', 'Paraguas', 'Volcán', 'Pulpo', 'Faro'];
  const propias = ['Patineta de Pili', 'Mesa de luz'];
  /** Un azar fijo: devuelve los valores en orden, y después siempre el último. */
  const azar = (...v: number[]) => () => (v.length > 1 ? v.shift()! : v[0]);

  it('sin palabras propias, sortea de la lista base', () => {
    const o = sortearConPropias(base, [], azar(0.1));
    expect(o).toHaveLength(3);
    expect(o.every((p) => base.includes(p))).toBe(true);
  });

  it('en la mitad de los turnos, una de las tres es propia', () => {
    const o = sortearConPropias(base, propias, azar(0.2, 0.3));
    expect(o).toHaveLength(3);
    expect(o.filter((p) => propias.includes(p))).toHaveLength(1);
  });

  it('en la otra mitad, salen de todas juntas', () => {
    for (let i = 0; i < 50; i++) {
      const o = sortearConPropias(base, propias, azar(0.7, Math.random()));
      expect(o).toHaveLength(3);
      expect(new Set(o).size).toBe(3);
    }
  });

  it('con una propia, nunca ofrece una base que se le parezca', () => {
    for (let i = 0; i < 100; i++) {
      // "Mate" está dentro de "Mate de Pili": se parecen (como Flor/Florero).
      const o = sortearConPropias(['Mate', 'Faro', 'Pulpo', 'Volcán'], ['Mate de Pili'], azar(0.1, Math.random()));
      expect(o).toContain('Mate de Pili');
      expect(o).not.toContain('Mate');
    }
  });
});
