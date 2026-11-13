import request from 'supertest';
import { crearAppDeTest, limpiar, PUSH_ACTIVO, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

const FCM = 'https://fcm.googleapis.com/fcm/send/';
const claves = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const dibujo = [{ color: '#1B2A7A', width: 0.02, points: [{ x: 0.1, y: 0.1, t: 0 }, { x: 0.5, y: 0.5, t: 100 }] }];

describe('Pistas', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;
  let turnoId: string;

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  const pista = (p: Persona, texto: unknown) => p.post(`/api/turnos/${turnoId}/pistas`, { texto });
  /** Juan elige "Mate" y manda el dibujo; Ana adivina. */
  const mandarDibujo = async () => {
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
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

  it('quien dibuja manda pistas sin límite, y las dos personas las ven en orden', async () => {
    await mandarDibujo();
    await pista(juan, '  Lo tomás todas las mañanas ').expect(200);
    const r = await pista(juan, 'Es verde').expect(200);
    expect(r.body.map((p: { texto: string }) => p.texto)).toEqual(['Lo tomás todas las mañanas', 'Es verde']);
    const deAna = (await ana.get(`/api/turnos/${turnoId}/pistas`).expect(200)).body;
    expect(deAna.map((p: { texto: string }) => p.texto)).toEqual(['Lo tomás todas las mañanas', 'Es verde']);
  });

  it('/estado cuenta las pistas, para que quien adivina sepa que llegó una', async () => {
    await mandarDibujo();
    expect((await estado(ana)).turno.pistas).toBe(0);
    await pista(juan, 'Es verde').expect(200);
    expect((await estado(ana)).turno.pistas).toBe(1);
    expect((await estado(juan)).turno.pistas).toBe(1);
  });

  it('la pista no puede tener la palabra', async () => {
    await mandarDibujo();
    const r = await pista(juan, 'Se toma un MATE').expect(400);
    expect(r.body).toEqual({ codigo: 'datos_invalidos', mensaje: 'La pista no puede tener la palabra.' });
    await pista(juan, 'mates amargos').expect(400);
    expect(await t.prisma.pista.count()).toBe(0);
  });

  it('solo quien dibuja, y solo mientras la otra persona adivina', async () => {
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    expect((await pista(juan, 'Es verde').expect(409)).body.codigo).toBe('turno_cerrado');
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: dibujo }).expect(200);
    expect((await pista(ana, 'Es verde').expect(403)).body.codigo).toBe('no_es_tu_turno');
    await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'mate' }).expect(200);
    expect((await pista(juan, 'Es verde').expect(409)).body.codigo).toBe('turno_cerrado');
  });

  it('valida el texto', async () => {
    await mandarDibujo();
    expect((await pista(juan, '').expect(400)).body.mensaje).toBe('Escribí una pista con letras o números.');
    expect((await pista(juan, 'a'.repeat(81)).expect(400)).body.mensaje).toBe('Usá 80 caracteres como máximo.');
  });

  it('avisa a quien adivina, con el texto', async () => {
    await request(t.app.getHttpServer())
      .post('/api/push/suscripciones')
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ endpoint: `${FCM}celu-ana`, keys: claves })
      .expect(204);
    await mandarDibujo();
    t.enviador.enviados = [];
    await pista(juan, 'Es verde').expect(200);
    await t.esperarAvisos();
    expect(t.enviador.enviados).toHaveLength(1);
    expect(t.enviador.enviados[0].payload.notification).toMatchObject({ title: 'Llegó una pista', body: 'Es verde' });
  });

  it('nadie de otra sala ve las pistas', async () => {
    await mandarDibujo();
    await pista(juan, 'Es verde').expect(200);
    const [otro] = (await salaCon(t, 'Otro', 'Otra')).personas;
    await otro.get(`/api/turnos/${turnoId}/pistas`).expect(404);
  });
});
