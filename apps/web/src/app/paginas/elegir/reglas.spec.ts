import { problemaDeLaPalabra, textoDeSalteos } from './reglas';

describe('problemaDeLaPalabra', () => {
  it.each(['', '   ', ' Mate', 'Mate ', 'a'.repeat(41), '¡¿?!', 'Ma\nte'])('rechaza %j', (p) => {
    expect(problemaDeLaPalabra(p)).not.toBeNull();
  });
  it.each(['M', 'Mate', 'El mate de Ñoño', 'a'.repeat(40), '🧉 mate'])('acepta %j', (p) => {
    expect(problemaDeLaPalabra(p)).toBeNull();
  });
});

describe('textoDeSalteos', () => {
  const formatear = (d: Date) => d.toISOString().slice(11, 16);

  it('con los 3, dice que se renuevan cada media hora', () => {
    expect(textoDeSalteos({ quedan: 3, maximo: 3, proximoEn: null }, formatear)).toEqual({
      titulo: 'Te quedan 3 de 3',
      detalle: 'Se renuevan cada media hora',
    });
  });

  it('con menos de 3, dice cuándo vuelve el próximo', () => {
    expect(textoDeSalteos({ quedan: 2, maximo: 3, proximoEn: '2026-11-07T13:30:00.000Z' }, formatear)).toEqual({
      titulo: 'Te quedan 2 de 3',
      detalle: 'Vuelve uno a las 13:30',
    });
    expect(textoDeSalteos({ quedan: 0, maximo: 3, proximoEn: '2026-11-07T13:30:00.000Z' }, formatear).titulo).toBe(
      'Te quedan 0 de 3',
    );
  });
});
