import { normalizar } from '../src/comun/texto.js';
import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

describe('Elegir palabra y saltear', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  const turnoActual = async () => (await estado(juan)).turno as { id: string; numero: number };
  const palabra = (p: Persona, id: string, body: object) => p.post(`/api/turnos/${id}/palabra`, body);
  const saltear = (p: Persona, id: string) => p.post(`/api/turnos/${id}/salteo`);

  beforeAll(async () => {
    t = await crearAppDeTest();
  });
  beforeEach(async () => {
    t.reloj.reiniciar();
    await limpiar(t.prisma);
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
  });
  afterAll(() => t.app.close());

  describe('POST /api/turnos/:id/palabra', () => {
    it('elegir una opción la guarda tal cual y normalizada, y pasa a dibujando', async () => {
      const { turno } = await estado(juan);
      const elegida = turno.opciones[1];
      const r = await palabra(juan, turno.id, { opcion: elegida }).expect(200);
      expect(r.body).toMatchObject({ estado: 'dibujando', palabra: elegida });

      const db = await t.prisma.turno.findUniqueOrThrow({ where: { id: turno.id } });
      expect(db).toMatchObject({ palabra: elegida, origen: 'sugerida', estado: 'dibujando' });
      // Con la misma función de la API: conserva la ñ ("Montaña" → "montaña").
      expect(db.palabraNormalizada).toBe(normalizar(elegida));
    });

    it('una palabra propia se guarda tal cual y también normalizada', async () => {
      const { id } = await turnoActual();
      await palabra(juan, id, { propia: '¡El Maté de Ñoño!' }).expect(200);
      const db = await t.prisma.turno.findUniqueOrThrow({ where: { id } });
      expect(db).toMatchObject({ palabra: '¡El Maté de Ñoño!', palabraNormalizada: 'el mate de ñoño', origen: 'propia' });
    });

    it('se puede cambiar mientras se dibuja', async () => {
      const { id } = await turnoActual();
      await palabra(juan, id, { propia: 'Uno' }).expect(200);
      await palabra(juan, id, { propia: 'Dos' }).expect(200);
      expect((await t.prisma.turno.findUniqueOrThrow({ where: { id } })).palabra).toBe('Dos');
    });

    it.each([
      ['ninguna', {}],
      ['las dos', { opcion: 'Mate', propia: 'Mate' }],
      ['propia vacía', { propia: '' }],
      ['propia con espacios', { propia: '   ' }],
      ['espacio al principio', { propia: ' Mate' }],
      ['espacio al final', { propia: 'Mate ' }],
      ['41 caracteres', { propia: 'a'.repeat(41) }],
      ['solo signos', { propia: '¡¿?!' }],
      ['campo de más', { propia: 'Mate', otro: 1 }],
      ['no es texto', { propia: 7 }],
    ])('rechaza: %s', async (_, body) => {
      const { id } = await turnoActual();
      const r = await palabra(juan, id, body).expect(400);
      expect(r.body.codigo).toBe('datos_invalidos');
      expect((await t.prisma.turno.findUniqueOrThrow({ where: { id } })).estado).toBe('eligiendo');
    });

    it('acepta una propia de 40 caracteres', async () => {
      const { id } = await turnoActual();
      await palabra(juan, id, { propia: 'a'.repeat(40) }).expect(200);
    });

    it('rechaza una opción que no está entre las 3', async () => {
      const { id } = await turnoActual();
      const r = await palabra(juan, id, { opcion: 'Zeppelin' }).expect(400);
      expect(r.body.mensaje).toBe('Esa palabra no es una de tus opciones.');
    });

    it('quien adivina no puede elegir', async () => {
      const { id } = await turnoActual();
      const r = await palabra(ana, id, { propia: 'Mate' }).expect(403);
      expect(r.body.codigo).toBe('no_es_tu_turno');
    });

    it('un turno de otra sala no existe para quien pide', async () => {
      const { id } = await turnoActual();
      const [intrusa] = (await salaCon(t, 'Intrusa')).personas;
      await palabra(intrusa, id, { propia: 'Mate' }).expect(404);
    });

    it('quien adivina no recibe la palabra propia en /api/estado', async () => {
      const { id } = await turnoActual();
      await palabra(juan, id, { propia: 'Chiste interno' }).expect(200);
      const crudo = (await ana.get('/api/estado').expect(200)).text;
      expect(crudo).not.toMatch(/chiste interno/i);
    });
  });

  describe('POST /api/turnos/:id/salteo', () => {
    it('el turno nuevo lo dibuja la otra persona, con 3 opciones nuevas', async () => {
      const antes = await estado(juan);
      const r = await saltear(juan, antes.turno.id).expect(200);
      expect(r.body.salteos).toEqual({ quedan: 2, maximo: 3, proximoEn: '2026-11-07T13:30:00.000Z' });

      const viejo = await t.prisma.turno.findUniqueOrThrow({ where: { id: antes.turno.id } });
      expect(viejo.estado).toBe('salteado');

      const deAna = await estado(ana);
      expect(deAna.turno).toMatchObject({ numero: 2, rol: 'dibuja', estado: 'eligiendo' });
      expect(deAna.turno.opciones).toHaveLength(3);
      expect(deAna.turno.opciones).not.toEqual(antes.turno.opciones);
      expect(deAna.anterior).toEqual({ resultado: 'salteado', dibuje: false });

      const deJuan = await estado(juan);
      expect(deJuan.turno).toMatchObject({ numero: 2, rol: 'adivina' });
      expect(deJuan.anterior).toEqual({ resultado: 'salteado', dibuje: true });
      expect(deJuan.salteos.quedan).toBe(2);
      expect(deAna.salteos.quedan).toBe(3);
    });

    it('reloj simulado: gastás uno, a los 29 min te quedan 2 y a los 30 volvés a tener 3', async () => {
      await saltear(juan, (await turnoActual()).id).expect(200);
      expect((await estado(juan)).salteos).toEqual({ quedan: 2, maximo: 3, proximoEn: '2026-11-07T13:30:00.000Z' });

      t.reloj.avanzarMinutos(29);
      expect((await estado(juan)).salteos.quedan).toBe(2);

      t.reloj.avanzarMinutos(1);
      expect((await estado(juan)).salteos).toEqual({ quedan: 3, maximo: 3, proximoEn: null });
    });

    it('con 0 salteos no se puede saltear, y a la media hora del primero vuelve uno', async () => {
      // Juan y Ana se pasan el turno: Juan saltea 3 veces, con un minuto entre cada una.
      for (let i = 0; i < 3; i++) {
        await saltear(juan, (await turnoActual()).id).expect(200);
        await saltear(ana, (await turnoActual()).id).expect(200);
        t.reloj.avanzarMinutos(1);
      }
      const e = await estado(juan);
      expect(e.salteos).toEqual({ quedan: 0, maximo: 3, proximoEn: '2026-11-07T13:30:00.000Z' });

      const r = await saltear(juan, e.turno.id).expect(409);
      expect(r.body.codigo).toBe('sin_salteos');
      expect((await turnoActual()).id).toBe(e.turno.id);

      t.reloj.avanzarMinutos(27); // 13:30
      expect((await estado(juan)).salteos).toMatchObject({ quedan: 1, proximoEn: '2026-11-07T13:31:00.000Z' });
      await saltear(juan, e.turno.id).expect(200);
    });

    it('un doble toque saltea una sola vez y gasta un solo salteo', async () => {
      const { id, numero } = await turnoActual();
      const r = await Promise.all([saltear(juan, id), saltear(juan, id), saltear(juan, id)]);
      expect(r.map((x) => x.status).sort()).toEqual([200, 409, 409]);
      expect(await t.prisma.salteo.count()).toBe(1);
      expect(await t.prisma.turno.count()).toBe(2);
      expect((await turnoActual()).numero).toBe(numero + 1);
      expect((await estado(juan)).salteos.quedan).toBe(2);
    });

    it('quien adivina no puede saltear', async () => {
      const r = await saltear(ana, (await turnoActual()).id).expect(403);
      expect(r.body.codigo).toBe('no_es_tu_turno');
    });

    it('después de mandar el dibujo no se puede saltear ni cambiar la palabra', async () => {
      const { id } = await turnoActual();
      await palabra(juan, id, { propia: 'Mate' }).expect(200);
      // El envío del dibujo llega en el paso 7: se simula pasando el turno a "adivinando".
      await t.prisma.turno.update({ where: { id }, data: { estado: 'adivinando' } });

      expect((await saltear(juan, id).expect(409)).body.codigo).toBe('turno_cerrado');
      expect((await palabra(juan, id, { propia: 'Otra' }).expect(409)).body.codigo).toBe('turno_cerrado');
      const db = await t.prisma.turno.findUniqueOrThrow({ where: { id } });
      expect(db).toMatchObject({ estado: 'adivinando', palabra: 'Mate' });
      expect(await t.prisma.salteo.count()).toBe(0);
    });
  });
});
