import request from 'supertest';
import type { Stroke } from '@garabato/shared';
import { crearAppDeTest, limpiar, PUSH_ACTIVO, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

const FCM = 'https://fcm.googleapis.com/fcm/send/';
const claves = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const sol: Stroke[] = [{ color: '#FFD400', width: 0.03, points: [{ x: 0.5, y: 0.2, t: 0 }, { x: 0.5, y: 0.8, t: 400 }] }];

describe('Dibujos libres', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  const dejar = (p: Persona, trazos: unknown = sol) => p.post('/api/libres', { trazos });

  beforeAll(async () => {
    t = await crearAppDeTest({ push: PUSH_ACTIVO });
  });
  beforeEach(async () => {
    t.reloj.reiniciar();
    await limpiar(t.prisma);
    t.enviador.enviados = [];
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
  });
  afterAll(() => t.app.close());

  it('se guarda sin turno y la otra persona lo ve como nuevo en /estado', async () => {
    const { id } = (await dejar(juan).expect(201)).body;
    const db = await t.prisma.dibujo.findUniqueOrThrow({ where: { id } });
    expect(db).toMatchObject({ turnoId: null, autorId: juan.jugador.id, duracionMs: 400, vistoEn: null });

    expect((await estado(ana)).libreNuevo).toEqual({ id, creadoEn: '2026-11-07T13:00:00.000Z' });
    // A quien lo dibujó no le aparece como nuevo.
    expect((await estado(juan)).libreNuevo).toBeNull();
  });

  it('no cuenta para el juego: el turno sigue igual', async () => {
    const antes = (await estado(juan)).turno;
    await dejar(juan).expect(201);
    expect((await estado(juan)).turno).toEqual(antes);
    expect(await t.prisma.turno.count()).toBe(1);
  });

  it('al abrirlo quien lo recibió, queda visto y deja de ser nuevo', async () => {
    const { id } = (await dejar(juan).expect(201)).body;
    const r = await ana.get(`/api/libres/${id}`).expect(200);
    expect(r.body).toEqual({ id, autor: 'Juan', mio: false, creadoEn: '2026-11-07T13:00:00.000Z', trazos: sol, duracionMs: 400 });
    expect((await t.prisma.dibujo.findUniqueOrThrow({ where: { id } })).vistoEn).not.toBeNull();
    expect((await estado(ana)).libreNuevo).toBeNull();
  });

  it('si lo abre quien lo dibujó, no queda visto', async () => {
    const { id } = (await dejar(juan).expect(201)).body;
    expect((await juan.get(`/api/libres/${id}`).expect(200)).body).toMatchObject({ mio: true });
    expect((await estado(ana)).libreNuevo).toMatchObject({ id });
  });

  it('con varios sin abrir, /estado muestra el último', async () => {
    await dejar(juan).expect(201);
    t.reloj.avanzarMinutos(1);
    const { id } = (await dejar(juan).expect(201)).body;
    expect((await estado(ana)).libreNuevo).toMatchObject({ id });
  });

  it('avisa a la otra persona y abre ese dibujo', async () => {
    await request(t.app.getHttpServer())
      .post('/api/push/suscripciones')
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ endpoint: `${FCM}celu-ana`, keys: claves })
      .expect(204);
    const { id } = (await dejar(juan).expect(201)).body;
    await t.esperarAvisos();
    expect(t.enviador.enviados).toHaveLength(1);
    const n = t.enviador.enviados[0].payload.notification;
    expect(n.title).toBe('Juan te dejó un dibujito');
    expect(n.body).toBe('Sin nada que adivinar. Abrilo cuando quieras.');
    expect(n.data.onActionClick.default.url).toBe(`/recibido/${id}`);
  });

  it('valida el dibujo igual que en el juego', async () => {
    const r = await dejar(juan, []).expect(400);
    expect(r.body).toEqual({ codigo: 'datos_invalidos', mensaje: 'El dibujo no tiene trazos.' });
  });

  it('sin la otra persona en la sala, no se puede dejar', async () => {
    const sola = (await salaCon(t, 'Sola')).personas[0];
    expect((await dejar(sola).expect(409)).body.codigo).toBe('falta_la_otra_persona');
  });

  it('nadie de otra sala lo puede ver, ni un dibujo de turno se ve como libre', async () => {
    const { id } = (await dejar(juan).expect(201)).body;
    const [otro] = (await salaCon(t, 'Otro', 'Otra')).personas;
    expect((await otro.get(`/api/libres/${id}`).expect(404)).body.codigo).toBe('libre_no_encontrado');

    const turnoId = (await estado(juan)).turno.id;
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: sol }).expect(200);
    const delTurno = await t.prisma.dibujo.findFirstOrThrow({ where: { turnoId } });
    await ana.get(`/api/libres/${delTurno.id}`).expect(404);
  });
});
