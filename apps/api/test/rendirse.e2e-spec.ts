import { crearAppDeTest, limpiar, PUSH_ACTIVO, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';
import request from 'supertest';

const FCM = 'https://fcm.googleapis.com/fcm/send/';
const claves = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const dibujo = [{ color: '#1B2A7A', width: 0.02, points: [{ x: 0.1, y: 0.1, t: 0 }, { x: 0.5, y: 0.5, t: 100 }] }];

describe('POST /api/turnos/:id/rendirse', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;
  let turnoId: string;

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  const rendirse = (p: Persona) => p.post(`/api/turnos/${turnoId}/rendirse`);
  /** Juan elige "Patineta" y manda el dibujo; Ana adivina. */
  const mandarDibujo = async () => {
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Patineta' }).expect(200);
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: dibujo }).expect(200);
  };

  beforeAll(async () => {
    t = await crearAppDeTest({ push: PUSH_ACTIVO });
  });
  beforeEach(async () => {
    t.reloj.reiniciar();
    await limpiar(t.prisma);
    t.enviador.enviados = [];
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
    turnoId = (await estado(juan)).turno.id;
  });
  afterAll(() => t.app.close());

  it('revela la palabra, cierra el turno y crea el siguiente, que dibuja quien se rindió', async () => {
    await mandarDibujo();
    await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'Mesa' }).expect(200);
    const r = await rendirse(ana).expect(200);
    expect(r.body).toEqual({ turnoId, palabra: 'Patineta' });

    expect((await t.prisma.turno.findUniqueOrThrow({ where: { id: turnoId } })).estado).toBe('rendido');
    const deAna = await estado(ana);
    expect(deAna.turno).toMatchObject({ numero: 2, rol: 'dibuja', estado: 'eligiendo' });
    expect(deAna.anterior).toEqual({ resultado: 'rendido', dibuje: false });
    expect((await estado(juan)).anterior).toEqual({ resultado: 'rendido', dibuje: true });
    expect(await t.prisma.salteo.count()).toBe(0);
  });

  it('el resumen queda disponible para los dos, con resultado "rendido"', async () => {
    await mandarDibujo();
    await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'Mesa' }).expect(200);
    await rendirse(ana).expect(200);
    const deAna = (await ana.get(`/api/turnos/${turnoId}/resumen`).expect(200)).body;
    expect(deAna).toMatchObject({ resultado: 'rendido', palabra: 'Patineta', intentos: 1, adivine: true });
    const deJuan = (await juan.get(`/api/turnos/${turnoId}/resumen`).expect(200)).body;
    expect(deJuan).toMatchObject({ resultado: 'rendido', adivine: false });
  });

  it('antes de rendirse, ninguna respuesta le da la palabra a quien adivina', async () => {
    await mandarDibujo();
    const crudos = [
      (await ana.get('/api/estado').expect(200)).text,
      (await ana.get(`/api/turnos/${turnoId}/dibujo`).expect(200)).text,
      (await ana.get(`/api/turnos/${turnoId}/resumen`).expect(409)).text,
    ];
    for (const c of crudos) expect(c).not.toMatch(/patineta/i);
  });

  it('quien dibuja no se puede rendir', async () => {
    await mandarDibujo();
    expect((await rendirse(juan).expect(403)).body.codigo).toBe('no_es_tu_turno');
  });

  it('no se puede rendir antes de que llegue el dibujo', async () => {
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Patineta' }).expect(200);
    expect((await rendirse(ana).expect(409)).body.codigo).toBe('turno_cerrado');
  });

  it('dos toques a la vez crean un solo turno nuevo', async () => {
    await mandarDibujo();
    const r = await Promise.all([rendirse(ana), rendirse(ana), rendirse(ana)]);
    expect(r.map((x) => x.status).sort()).toEqual([200, 409, 409]);
    expect(await t.prisma.turno.count()).toBe(2);
  });

  it('después de rendirse ya no se puede probar ni volver a rendirse', async () => {
    await mandarDibujo();
    await rendirse(ana).expect(200);
    await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'Patineta' }).expect(409);
    await rendirse(ana).expect(409);
  });

  it('avisa a quien dibujó, con la palabra', async () => {
    await request(t.app.getHttpServer())
      .post('/api/push/suscripciones')
      .set('Authorization', `Bearer ${juan.token}`)
      .send({ endpoint: `${FCM}celu-juan`, keys: claves })
      .expect(204);
    await mandarDibujo();
    t.enviador.enviados = [];
    await rendirse(ana).expect(200);
    await t.esperarAvisos();
    expect(t.enviador.enviados).toHaveLength(1);
    const n = t.enviador.enviados[0].payload.notification;
    expect(n.title).toBe('Ana se rindió');
    expect(n.body).toBe('Era Patineta. Ahora te toca adivinar a vos.');
    expect(n.data.onActionClick.default.url).toBe(`/acierto/${turnoId}`);
  });
});
