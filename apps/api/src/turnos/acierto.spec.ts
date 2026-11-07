import { acierta, sinArticulo, variantes } from './acierto.js';

describe('acierta', () => {
  it.each([
    // Acordadas antes
    ['MATÉ', 'Mate'],
    ['maet', 'Mate'],
    ['mate', 'Mate'],
    // Artículo al principio
    ['el mate', 'Mate'],
    ['El Mate', 'Mate'],
    ['un sol', 'Sol'],
    ['unas flores', 'Flor'],
    ['mate', 'El mate'],
    // Plural
    ['mates', 'Mate'],
    ['flores', 'Flor'],
    ['Las Flores', 'Flor'],
    ['flor', 'Flores'],
    // Errores chicos por largo
    ['slo', 'Sol'], // 3 letras: intercambio
    ['banama', 'Banana'], // 6 letras: 1 error
    ['bananaa', 'Banana'],
    ['bisicreta', 'Bicicleta'], // 9 letras: 2 errores
    ['pinguino', 'Pingüino'],
    ['chiste interno', 'Chiste interno'],
    ['arco iris', 'Arcoíris'], // 8 letras: un espacio de más es 1 error
  ])('"%s" acierta "%s"', (respuesta, palabra) => {
    expect(acierta(respuesta, palabra)).toBe(true);
  });

  it.each([
    ['gato', 'Pato'], // 4 letras: una sustitución no vale
    ['sal', 'Sol'],
    ['mat', 'Mate'], // 4 letras: falta una
    ['matee', 'Mate'], // 4 letras: sobra una que no es plural
    ['bonama', 'Banana'], // 6 letras: 2 errores
    ['bisicrota', 'Bicicleta'], // 9 letras: 3 errores
    ['taza', 'Mate'],
    ['el', 'Mate'],
    ['', 'Mate'],
    ['¡¿?!', 'Mate'],
    ['los', 'Sol'],
  ])('"%s" no acierta "%s"', (respuesta, palabra) => {
    expect(acierta(respuesta, palabra)).toBe(false);
  });
});

describe('sinArticulo', () => {
  it.each([
    ['El mate', 'mate'],
    ['los gatos', 'gatos'],
    ['la', 'la'], // si no queda nada, no lo saca
    ['elefante', 'elefante'], // "el" solo cuenta como palabra suelta
  ])('%s → %s', (a, b) => expect(sinArticulo(a)).toBe(b));
});

describe('variantes', () => {
  it('suma las formas sin "s" y sin "es"', () => {
    expect(variantes('flores')).toEqual(['flores', 'flore', 'flor']);
    expect(variantes('mates')).toEqual(['mates', 'mate', 'mat']);
    expect(variantes('mate')).toEqual(['mate']);
  });
});
