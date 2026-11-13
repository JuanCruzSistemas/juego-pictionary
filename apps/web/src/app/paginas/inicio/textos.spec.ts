import type { Estado, TurnoActual, TurnoAnterior } from '@garabato/shared';
import { tarjetaDeInicio } from './textos';

const yo = { id: 'j', nombre: 'Juan', lugar: 1 };
const ana = { id: 'a', nombre: 'Ana', lugar: 2 };

function estado(turno: Partial<TurnoActual> | null, anterior: TurnoAnterior | null = null): Estado {
  return {
    yo,
    otro: turno ? ana : null,
    invitacion: 'abc',
    turno: turno ? { id: 't', numero: 3, rol: 'dibuja', estado: 'eligiendo', intentos: 0, pistas: 0, ...turno } : null,
    anterior,
    salteos: { quedan: 3, maximo: 3, proximoEn: null },
    libreNuevo: null,
  };
}

describe('tarjetaDeInicio', () => {
  it('sin la otra persona, espera y ofrece compartir', () => {
    const t = tarjetaDeInicio(estado(null));
    expect(t.titulo).toBe('Esperando que entre');
    expect(t.compartir).toBe(true);
  });

  it('con la otra persona adentro nunca dice "Esperando que entre", aunque todavía no haya turno', () => {
    const t = tarjetaDeInicio({ ...estado(null), otro: ana });
    expect(t.titulo).not.toBe('Esperando que entre');
    expect(t.compartir).toBeUndefined();
    expect(t.texto).toContain('Ana');
  });

  it('dibujar: elegir palabra o seguir dibujando', () => {
    expect(tarjetaDeInicio(estado({ estado: 'eligiendo' })).accion).toEqual({ texto: 'Elegir palabra', ruta: '/elegir' });
    expect(tarjetaDeInicio(estado({ estado: 'dibujando' })).accion?.ruta).toBe('/dibujar');
  });

  it('dibujar: el texto depende de cómo terminó el turno anterior', () => {
    expect(tarjetaDeInicio(estado({})).texto).toBe('Arrancás vos. Elegí una palabra y dibujásela a Ana.');
    expect(tarjetaDeInicio(estado({}, { resultado: 'adivinado', dibuje: false })).texto).toBe(
      'Adivinaste su último dibujo. Ahora le toca adivinar a Ana.',
    );
    expect(tarjetaDeInicio(estado({}, { resultado: 'salteado', dibuje: false })).texto).toBe(
      'Ana salteó su turno, así que te toca a vos.',
    );
  });

  it('después de rendirse: quien se rindió dibuja, y quien dibujó lo ve al esperar', () => {
    expect(tarjetaDeInicio(estado({}, { resultado: 'rendido', dibuje: false })).texto).toBe(
      'Te rendiste con su último dibujo. Ahora le toca adivinar a Ana.',
    );
    expect(tarjetaDeInicio(estado({ rol: 'adivina' }, { resultado: 'rendido', dibuje: true })).texto).toBe(
      'Se rindió con tu dibujo. Cuando lo mande, te toca adivinar.',
    );
  });

  it('esperar mientras adivina, con los intentos y el botón para mandar pistas', () => {
    const t = tarjetaDeInicio(estado({ estado: 'adivinando', intentos: 3 }));
    expect(t).toMatchObject({ titulo: 'Ana está adivinando', texto: 'Lleva 3 intentos.' });
    expect(t.accion).toEqual({ texto: 'Ver intentos y mandar pista', ruta: '/seguimiento' });
    expect(tarjetaDeInicio(estado({ estado: 'adivinando', intentos: 1 })).texto).toBe('Lleva 1 intento.');
  });

  it('adivinar', () => {
    const t = tarjetaDeInicio(estado({ rol: 'adivina', estado: 'adivinando' }));
    expect(t).toMatchObject({ titulo: 'Te toca adivinar', accion: { ruta: '/adivinar' } });
    expect(t.texto).toContain('Ana');
  });

  it('esperar mientras la otra persona elige o dibuja', () => {
    expect(tarjetaDeInicio(estado({ rol: 'adivina', estado: 'eligiendo' })).titulo).toBe('Ana está eligiendo qué dibujar');
    expect(tarjetaDeInicio(estado({ rol: 'adivina', estado: 'dibujando' })).titulo).toBe('Ana está dibujando');
    expect(tarjetaDeInicio(estado({ rol: 'adivina' }, { resultado: 'salteado', dibuje: true })).texto).toBe(
      'Salteaste tu turno. Cuando lo mande, te toca adivinar.',
    );
  });

  it('nunca dice "Ella"', () => {
    const casos: Partial<TurnoActual>[] = [
      { estado: 'eligiendo' }, { estado: 'adivinando' },
      { rol: 'adivina', estado: 'eligiendo' }, { rol: 'adivina', estado: 'adivinando' },
    ];
    for (const c of casos) {
      const t = tarjetaDeInicio(estado(c, { resultado: 'adivinado', dibuje: c.rol === 'adivina' }));
      expect(`${t.titulo} ${t.texto}`).not.toMatch(/\bella\b/i);
    }
  });
});
