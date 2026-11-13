import { ESPERA_INVITACION_MS, ESPERA_RECONEXION_MS, VivoRegistro } from './vivo.registro.js';

describe('VivoRegistro', () => {
  let r: VivoRegistro;
  let cambios: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    r = new VivoRegistro();
    cambios = [];
    r.alCambiar = (salaId) => cambios.push(`${salaId}:${r.vista(salaId)?.estado ?? 'fin'}`);
  });
  afterEach(() => vi.useRealTimers());

  it('invitar deja la partida esperando, y con las dos personas pasa a activa', () => {
    r.invitar('s', 'juan', ['juan']);
    expect(r.vista('s')).toEqual({ estado: 'esperando', invitadorId: 'juan', presentes: ['juan'] });
    r.actualizar('s', ['juan', 'ana']);
    expect(r.estaActiva('s')).toBe(true);
    expect(cambios).toEqual(['s:esperando', 's:activa']);
  });

  it('una invitación sin respuesta vence', () => {
    r.invitar('s', 'juan', ['juan']);
    vi.advanceTimersByTime(ESPERA_INVITACION_MS);
    expect(r.vista('s')).toBeNull();
  });

  it('si alguien se va, se pausa; si no vuelve a tiempo, termina', () => {
    r.invitar('s', 'juan', ['juan', 'ana']);
    r.actualizar('s', ['juan']);
    expect(r.vista('s')?.estado).toBe('pausada');
    vi.advanceTimersByTime(ESPERA_RECONEXION_MS - 1);
    expect(r.vista('s')?.estado).toBe('pausada');
    vi.advanceTimersByTime(1);
    expect(r.vista('s')).toBeNull();
  });

  it('si vuelve a tiempo, sigue activa y el plazo se cancela', () => {
    r.invitar('s', 'juan', ['juan', 'ana']);
    r.actualizar('s', ['juan']);
    r.actualizar('s', ['juan', 'ana']);
    vi.advanceTimersByTime(ESPERA_RECONEXION_MS * 2);
    expect(r.estaActiva('s')).toBe(true);
  });

  it('sin partida, si las dos personas están en la pantalla se arma sola (por ejemplo, tras un reinicio)', () => {
    r.actualizar('s', ['juan']);
    expect(r.vista('s')).toBeNull();
    r.actualizar('s', ['juan', 'juan', 'ana']);
    expect(r.estaActiva('s')).toBe(true);
  });

  it('el dibujo en curso es del turno: uno nuevo arranca vacío', () => {
    r.invitar('s', 'juan', ['juan', 'ana']);
    const trazo = { color: '#1B2A7A', width: 0.02, points: [{ x: 0, y: 0, t: 0 }] };
    expect(r.iniciarTrazo('s', 't1', 0, trazo)).toBe(true);
    expect(r.agregarPuntos('s', 't1', 0, [{ x: 1, y: 1, t: 5 }])).toBe(true);
    expect(r.trazosDe('s', 't1')[0].points).toHaveLength(2);
    expect(r.trazosDe('s', 't2')).toEqual([]);
    expect(r.agregarPuntos('s', 't2', 0, [{ x: 1, y: 1, t: 5 }])).toBe(false);
    expect(r.iniciarTrazo('s', 't2', 3, trazo)).toBe(false); // no puede saltear posiciones
  });
});
