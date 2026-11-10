import { tarjetasExtra } from './tarjetas';

describe('tarjetasExtra', () => {
  it('si están las dos, primero la de avisos', () => {
    expect(tarjetasExtra({ avisos: true, instalar: true })).toEqual(['avisos', 'instalar']);
  });
  it('una sola, o ninguna', () => {
    expect(tarjetasExtra({ avisos: false, instalar: true })).toEqual(['instalar']);
    expect(tarjetasExtra({ avisos: true, instalar: false })).toEqual(['avisos']);
    expect(tarjetasExtra({ avisos: false, instalar: false })).toEqual([]);
  });
});
