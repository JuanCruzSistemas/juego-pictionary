import { cuando } from './cuando';

describe('cuando', () => {
  const ahora = new Date(2026, 10, 13, 2, 30);

  it('hoy y ayer, con la hora', () => {
    expect(cuando(new Date(2026, 10, 13, 0, 5).toISOString(), ahora)).toBe('Hoy, 00:05');
    expect(cuando(new Date(2026, 10, 12, 23, 59).toISOString(), ahora)).toBe('Ayer, 23:59');
  });

  it('más atrás, con el día y el mes', () => {
    expect(cuando(new Date(2026, 10, 8, 18, 5).toISOString(), ahora)).toMatch(/^8 .*nov.*, 18:05$/);
  });
});
