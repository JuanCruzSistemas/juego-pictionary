import { PALABRAS_BASE } from './palabras-base.js';

describe('PALABRAS_BASE', () => {
  it('alcanza para ofrecer 3 opciones distintas', () => {
    expect(PALABRAS_BASE.length).toBeGreaterThanOrEqual(3);
  });

  it('no tiene repetidas, aunque cambien tildes o mayúsculas', () => {
    const claves = PALABRAS_BASE.map((p) =>
      p.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(),
    );
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('no tiene palabras vacías ni con espacios de más', () => {
    for (const p of PALABRAS_BASE) {
      expect(p).toBe(p.trim());
      expect(p.length).toBeGreaterThan(0);
    }
  });
});
