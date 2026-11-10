import { leerInvitacion } from './invitacion';

const INV = 'k8hz5KCT1pzLWpRjWRXEtU-MhFxHAJHGAkHA6Ou-p3M';

describe('leerInvitacion', () => {
  it.each([
    [`https://garabato-alw3.onrender.com/s/${INV}`, 'link de producción'],
    [`https://algo.trycloudflare.com/s/${INV}`, 'link de otro dominio'],
    [`garabato-alw3.onrender.com/s/${INV}`, 'sin https://'],
    [`  https://garabato-alw3.onrender.com/s/${INV}/  `, 'con espacios y barra final'],
    [`https://garabato-alw3.onrender.com/s/${INV}?utm=x`, 'con parámetros'],
    [`Entrá acá: https://garabato-alw3.onrender.com/s/${INV}`, 'con texto alrededor'],
    [INV, 'solo la invitación'],
  ])('acepta %s (%s)', (texto) => {
    expect(leerInvitacion(texto)).toEqual({ invitacion: INV });
  });

  it('vacío: pide pegar el link', () => {
    expect(leerInvitacion('   ')).toEqual({ problema: 'Pegá el link que te pasaron.' });
  });

  it.each([`https://garabato-alw3.onrender.com/s/${INV.slice(0, 30)}`, INV.slice(0, 20), `${INV}abc`])(
    'incompleto o de más: %s',
    (texto) => {
      expect(leerInvitacion(texto)).toEqual({ problema: 'El link está incompleto. Copialo entero y probá de nuevo.' });
    },
  );

  it.each(['https://google.com', 'hola, ¿qué tal?', 'https://garabato-alw3.onrender.com/elegir'])(
    'no es un link de Garabato: %s',
    (texto) => {
      expect('problema' in leerInvitacion(texto)).toBe(true);
      expect(leerInvitacion(texto)).not.toEqual({ problema: 'Pegá el link que te pasaron.' });
    },
  );
});
