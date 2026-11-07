import request from 'supertest';
import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

describe('Intentos', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;
  let invitacion: string;
  let turnoId: string;

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  const probar = (p: Persona, texto: unknown) => p.post(`/api/turnos/${turnoId}/intentos`, { texto });
  const dibujo = [{ color: '#1B2A7A', width: 0.02, points: [{ x: 0.1, y: 0.1, t: 0 }, { x: 0.5, y: 0.5, t: 100 }] }];

  /** Juan dibuja `palabra` y la manda; Ana adivina. */
  async function prepararTurno(palabra: string) {
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: palabra }).expect(200);
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: dibujo }).expect(200);
  }

  beforeAll(async () => {
    t = await crearAppDeTest();
  });
  beforeEach(async () => {
    t.reloj.reiniciar();
    await limpiar(t.prisma);
    const sala = await salaCon(t, 'Juan', 'Ana');
    [juan, ana] = sala.personas;
    invitacion = sala.invitacion;
    turnoId = (await estado(juan)).turno.id;
  });
  afterAll(() => t.app.close());

  it('una respuesta fallida se guarda, y la lista va de la más nueva a la más vieja', async () => {
    await prepararTurno('Mate');
    expect((await probar(ana, 'Taza').expect(200)).body).toMatchObject({ resultado: 'incorrecto' });
    const r = await probar(ana, 'Florero').expect(200);
    expect(r.body.resultado).toBe('incorrecto');
    expect(r.body).not.toHaveProperty('palabra');
    expect(r.body.intentos.map((i: { texto: string }) => i.texto)).toEqual(['Florero', 'Taza']);

    const lista = (await ana.get(`/api/turnos/${turnoId}/intentos`).expect(200)).body;
    expect(lista.map((i: { texto: string }) => i.texto)).toEqual(['Florero', 'Taza']);
  });

  it('quien dibujó ve en /estado cuántos intentos lleva', async () => {
    await prepararTurno('Mate');
    await probar(ana, 'Taza');
    await probar(ana, 'Termo');
    await probar(ana, 'Florero');
    expect((await estado(juan)).turno).toMatchObject({ estado: 'adivinando', intentos: 3 });
  });

  it('una repetida (sin tildes ni mayúsculas) no se guarda de nuevo', async () => {
    await prepararTurno('Mate');
    await probar(ana, 'Café').expect(200);
    const r = await probar(ana, '  CAFE!  ').expect(200);
    expect(r.body.resultado).toBe('repetido');
    expect(r.body.intentos).toHaveLength(1);
    expect(await t.prisma.intento.count()).toBe(1);
  });

  it('dos respuestas iguales a la vez se guardan una sola vez', async () => {
    await prepararTurno('Mate');
    const r = await Promise.all([probar(ana, 'Taza'), probar(ana, 'taza'), probar(ana, 'TAZA')]);
    expect(r.map((x) => x.body.resultado).sort()).toEqual(['incorrecto', 'repetido', 'repetido']);
    expect(await t.prisma.intento.count()).toBe(1);
  });

  it('el texto se guarda recortado', async () => {
    await prepararTurno('Mate');
    await probar(ana, '  Taza  ');
    expect((await t.prisma.intento.findFirstOrThrow()).texto).toBe('Taza');
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['solo signos', '¡¿?!'],
    ['no es texto', 5],
    ['61 caracteres', 'a'.repeat(61)],
  ])('rechaza la respuesta: %s', async (_, texto) => {
    await prepararTurno('Mate');
    expect((await probar(ana, texto).expect(400)).body.codigo).toBe('datos_invalidos');
    expect(await t.prisma.intento.count()).toBe(0);
  });

  it.each([
    ['el mate', 'Mate'],
    ['mates', 'Mate'],
    ['Las Flores', 'Flor'],
    ['MATÉ', 'Mate'],
    ['maet', 'Mate'],
  ])('"%s" acierta "%s"', async (respuesta, palabra) => {
    await prepararTurno(palabra);
    const r = await probar(ana, respuesta).expect(200);
    expect(r.body).toMatchObject({ resultado: 'correcto', palabra });
  });

  it('"gato" no acierta "Pato"', async () => {
    await prepararTurno('Pato');
    expect((await probar(ana, 'gato').expect(200)).body.resultado).toBe('incorrecto');
  });

  it('al acertar se cierra el turno y se crea el siguiente, que dibuja quien adivinó', async () => {
    await prepararTurno('Mate');
    await probar(ana, 'Taza');
    await probar(ana, 'mate').expect(200);

    const viejo = await t.prisma.turno.findUniqueOrThrow({ where: { id: turnoId } });
    expect(viejo.estado).toBe('adivinado');
    expect(viejo.adivinadoEn).toEqual(new Date('2026-11-07T13:00:00.000Z'));

    const deAna = await estado(ana);
    expect(deAna.turno).toMatchObject({ numero: 2, rol: 'dibuja', estado: 'eligiendo' });
    expect(deAna.turno.opciones).toHaveLength(3);
    expect(deAna.anterior).toEqual({ resultado: 'adivinado', dibuje: false });
    expect((await estado(juan)).turno).toMatchObject({ numero: 2, rol: 'adivina' });

    // Ya no se puede seguir probando en el turno cerrado.
    expect((await probar(ana, 'otra').expect(409)).body.codigo).toBe('turno_cerrado');
  });

  it('dos aciertos a la vez crean un solo turno nuevo', async () => {
    await prepararTurno('Mate');
    const r = await Promise.all([probar(ana, 'mate'), probar(ana, 'el mate')]);
    expect(r.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(await t.prisma.turno.count()).toBe(2);
  });

  it('quien dibuja no puede probar, y no se puede probar antes de que llegue el dibujo', async () => {
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    expect((await probar(ana, 'mate').expect(409)).body.codigo).toBe('turno_cerrado');
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: dibujo }).expect(200);
    expect((await probar(juan, 'mate').expect(403)).body.codigo).toBe('no_es_tu_turno');
  });

  it('la respuesta correcta no aparece en ninguna respuesta de la API antes de acertar', async () => {
    await prepararTurno('Zeppelin');
    const http = () => request(t.app.getHttpServer());
    const conAna = (r: request.Test) => r.set('Authorization', `Bearer ${ana.token}`);
    const textos: string[] = [];
    const guardar = (r: request.Response) => (textos.push(r.text), r);

    for (const fallo of ['Avión', 'Globo', 'Ballena', 'avion', 'Dirigible']) {
      guardar(await probar(ana, fallo).expect(200));
      guardar(await ana.get('/api/estado').expect(200));
      guardar(await ana.get(`/api/turnos/${turnoId}/intentos`).expect(200));
      guardar(await ana.get(`/api/turnos/${turnoId}/dibujo`).expect(200));
      const resumen = guardar(await ana.get(`/api/turnos/${turnoId}/resumen`).expect(409));
      expect(resumen.body.codigo).toBe('resumen_no_disponible');
      guardar(await juan.get(`/api/turnos/${turnoId}/resumen`).expect(409));
    }
    guardar(await http().get(`/api/salas/${invitacion}`).expect(200));
    // Lo que intente quien adivina sobre endpoints de quien dibuja también falla sin filtrar nada.
    guardar(await conAna(http().post(`/api/turnos/${turnoId}/palabra`)).send({ propia: 'x' }));
    guardar(await conAna(http().post(`/api/turnos/${turnoId}/salteo`)));
    guardar(await conAna(http().post(`/api/turnos/${turnoId}/dibujo`)).send({ trazos: dibujo }));
    guardar(await probar(ana, '¡¿?!'));

    expect(textos.length).toBeGreaterThan(20);
    for (const texto of textos) expect(texto).not.toMatch(/zeppelin/i);

    // Después de acertar, sí: en la respuesta del acierto y en el resumen.
    const r = await probar(ana, 'zepelin').expect(200);
    expect(r.body).toMatchObject({ resultado: 'correcto', palabra: 'Zeppelin' });
    const resumen = (await ana.get(`/api/turnos/${turnoId}/resumen`).expect(200)).body;
    expect(resumen).toEqual({
      turnoId,
      numero: 1,
      palabra: 'Zeppelin',
      intentos: 5, // 4 fallidas ("avion" repite a "Avión") y el acierto
      trazos: dibujo,
      adivine: true,
    });
    expect((await juan.get(`/api/turnos/${turnoId}/resumen`).expect(200)).body).toMatchObject({ palabra: 'Zeppelin', adivine: false });
  });

  it('el resumen no existe para alguien de otra sala, ni siquiera adivinado', async () => {
    await prepararTurno('Mate');
    await probar(ana, 'mate').expect(200);
    const [intrusa] = (await salaCon(t, 'Intrusa')).personas;
    const r = await intrusa.get(`/api/turnos/${turnoId}/resumen`).expect(404);
    expect(r.text).not.toMatch(/mate/i);
  });

  it('un turno salteado no tiene resumen', async () => {
    await juan.post(`/api/turnos/${turnoId}/salteo`).expect(200);
    expect((await ana.get(`/api/turnos/${turnoId}/resumen`).expect(409)).body.codigo).toBe('resumen_no_disponible');
  });
});
