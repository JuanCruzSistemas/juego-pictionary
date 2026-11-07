import request from 'supertest';
import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { generarToken, hashToken } from '../src/sesion/tokens.js';

describe('Salas y sesión', () => {
  let t: AppDeTest;
  let invitacion: string;
  const http = () => request(t.app.getHttpServer());
  const entrar = (nombre: unknown) => http().post(`/api/salas/${invitacion}/jugadores`).send({ nombre });

  beforeAll(async () => {
    t = await crearAppDeTest();
  });

  beforeEach(async () => {
    await limpiar(t.prisma);
    invitacion = generarToken();
    await t.prisma.sala.create({ data: { invitacion } });
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('GET /api/salas/:invitacion', () => {
    it('da 404 con un link que no existe', async () => {
      const r = await http().get('/api/salas/no-existe').expect(404);
      expect(r.body.codigo).toBe('sala_no_encontrada');
    });

    it('sin nadie adentro, no hay quien invite', async () => {
      await http().get(`/api/salas/${invitacion}`).expect(200, { llena: false, invitadoPor: null });
    });

    it('con una persona adentro, devuelve su nombre', async () => {
      await entrar('Juan').expect(201);
      await http().get(`/api/salas/${invitacion}`).expect(200, { llena: false, invitadoPor: 'Juan' });
    });

    it('llena, no expone los nombres', async () => {
      await entrar('Juan').expect(201);
      await entrar('Ana').expect(201);
      await http().get(`/api/salas/${invitacion}`).expect(200, { llena: true });
    });
  });

  describe('POST /api/salas/:invitacion/jugadores', () => {
    it('da token y lugares 1 y 2, y rechaza a la tercera persona', async () => {
      const a = await entrar('Juan').expect(201);
      const b = await entrar('Ana').expect(201);
      expect(a.body.jugador).toMatchObject({ nombre: 'Juan', lugar: 1 });
      expect(b.body.jugador).toMatchObject({ nombre: 'Ana', lugar: 2 });
      expect(a.body.token).not.toBe(b.body.token);

      const c = await entrar('Intrusa').expect(409);
      expect(c.body).toEqual({ codigo: 'sala_llena', mensaje: expect.any(String) });
    });

    it('guarda solo el hash del token', async () => {
      const r = await entrar('Juan').expect(201);
      const j = await t.prisma.jugador.findUniqueOrThrow({ where: { id: r.body.jugador.id } });
      expect(j.sesionHash).toBe(hashToken(r.body.token));
      expect(j.sesionHash).not.toBe(r.body.token);
    });

    it('da 404 con un link que no existe', async () => {
      const r = await http().post('/api/salas/no-existe/jugadores').send({ nombre: 'Juan' }).expect(404);
      expect(r.body.codigo).toBe('sala_no_encontrada');
    });

    it.each([
      ['falta', undefined],
      ['vacío', ''],
      ['solo espacios', '   '],
      ['espacio al principio', ' Juan'],
      ['espacio al final', 'Juan '],
      ['31 caracteres', 'a'.repeat(31)],
      ['no es texto', 42],
      ['salto de línea', 'Ju\nan'],
    ])('rechaza el nombre: %s', async (_, nombre) => {
      const r = await entrar(nombre).expect(400);
      expect(r.body.codigo).toBe('datos_invalidos');
      expect(typeof r.body.mensaje).toBe('string');
      expect(await t.prisma.jugador.count()).toBe(0);
    });

    it.each([
      ['1 caracter', 'J'],
      ['30 caracteres', 'a'.repeat(30)],
      ['espacios en el medio', 'Juan Cruz'],
      ['emojis de a uno', '🙂'.repeat(30)],
    ])('acepta el nombre: %s', async (_, nombre) => {
      await entrar(nombre).expect(201);
    });

    it('si entran tres a la vez, quedan exactamente dos', async () => {
      const r = await Promise.all([entrar('A'), entrar('B'), entrar('C')]);
      expect(r.map((x) => x.status).sort()).toEqual([201, 201, 409]);
      const lugares = (await t.prisma.jugador.findMany()).map((j) => j.lugar).sort();
      expect(lugares).toEqual([1, 2]);
    });
  });

  describe('GET /api/estado', () => {
    it('sin token da 401', async () => {
      const r = await http().get('/api/estado').expect(401);
      expect(r.body.codigo).toBe('sesion_invalida');
    });

    it('con un token inventado da 401', async () => {
      await http().get('/api/estado').set('Authorization', `Bearer ${generarToken()}`).expect(401);
    });

    it('muestra a quien pregunta y a la otra persona cuando entra', async () => {
      const a = await entrar('Juan').expect(201);
      const conA = () => http().get('/api/estado').set('Authorization', `Bearer ${a.body.token}`);

      const antes = await conA().expect(200);
      expect(antes.body).toEqual({ yo: a.body.jugador, otro: null, invitacion, turno: null, anterior: null });

      const b = await entrar('Ana').expect(201);
      const despues = await conA().expect(200);
      expect(despues.body.otro).toEqual(b.body.jugador);
    });
  });
});
