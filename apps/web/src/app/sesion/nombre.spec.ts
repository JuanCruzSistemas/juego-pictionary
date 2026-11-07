import { problemaDelNombre } from './nombre';

describe('problemaDelNombre', () => {
  it.each(['', '   ', ' Juan', 'Juan ', 'a'.repeat(31), 'Ju\nan'])('rechaza %j', (nombre) => {
    expect(problemaDelNombre(nombre)).not.toBeNull();
  });

  it.each(['J', 'Juan Cruz', 'a'.repeat(30), '🙂'.repeat(30)])('acepta %j', (nombre) => {
    expect(problemaDelNombre(nombre)).toBeNull();
  });
});
