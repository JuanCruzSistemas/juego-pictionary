import request from 'supertest';
import { crearAppDeTest, limpiar, PUSH_ACTIVO, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

const FCM = 'https://fcm.googleapis.com/fcm/send/';
const claves = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const dibujo = [{ color: '#1B2A7A', width: 0.02, points: [{ x: 0.1, y: 0.1, t: 0 }, { x: 0.5, y: 0.5, t: 100 }] }];

describe('Avisos push', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;
  let turnoId: string;

  const suscribir = (p: Persona, dispositivo: string) =>
    request(t.app.getHttpServer())
      .post('/api/push/suscripciones')
      .set('Authorization', `Bearer ${p.token}`)
      .send({ endpoint: `${FCM}${dispositivo}`, keys: claves })
      .expect(204);
  const avisosA = (dispositivo: string) => t.enviador.enviados.filter((e) => e.endpoint === `${FCM}${dispositivo}`);
  const textos = () => t.enviador.enviados.map((e) => `${e.endpoint.slice(FCM.length)}: ${e.payload.notification.title}`);
  /** Juan elige "Mate" y manda el dibujo. */
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
    t.enviador.respuestas.clear();
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
    turnoId = (await juan.get('/api/estado').expect(200)).body.turno.id;
    await suscribir(juan, 'celu-juan');
    await suscribir(ana, 'celu-ana');
    await suscribir(ana, 'tablet-ana');
  });
  afterAll(() => t.app.close());

  it('"Te dibujaron algo": a todos los dispositivos de quien adivina, y a nadie más', async () => {
    await mandarDibujo();
    await t.esperarAvisos();
    expect(textos().sort()).toEqual(['celu-ana: Te dibujaron algo', 'tablet-ana: Te dibujaron algo']);
    const n = avisosA('celu-ana')[0].payload.notification;
    expect(n.body).toBe('Juan terminó su dibujo. Te toca adivinar.');
    expect(n.data.onActionClick.default.url).toBe('/adivinar');
    expect(JSON.stringify(avisosA('celu-ana')[0].payload)).not.toMatch(/mate/i);
  });

  it('un reintento del mismo dibujo no avisa de nuevo', async () => {
    await mandarDibujo();
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: dibujo }).expect(200);
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: dibujo }).expect(200);
    await t.esperarAvisos();
    expect(avisosA('celu-ana')).toHaveLength(1);
  });

  it('una respuesta fallida no avisa; el acierto avisa a quien dibujó, con la palabra', async () => {
    await mandarDibujo();
    await t.esperarAvisos();
    t.enviador.enviados = [];

    await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'Taza' }).expect(200);
    await t.esperarAvisos();
    expect(t.enviador.enviados).toHaveLength(0);

    await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'el mate' }).expect(200);
    await t.esperarAvisos();
    expect(textos()).toEqual(['celu-juan: Adivinó tu dibujo']);
    const n = avisosA('celu-juan')[0].payload.notification;
    expect(n.body).toBe('Era Mate. Ahora te toca adivinar a vos.');
    expect(n.data.onActionClick.default.url).toBe(`/acierto/${turnoId}`);
  });

  it('"Te toca dibujar": cuando saltean, a quien pasa a dibujar', async () => {
    await juan.post(`/api/turnos/${turnoId}/salteo`).expect(200);
    await t.esperarAvisos();
    expect(textos().sort()).toEqual(['celu-ana: Te toca dibujar', 'tablet-ana: Te toca dibujar']);
    const n = avisosA('celu-ana')[0].payload.notification;
    expect(n.body).toBe('Juan te pasó el turno. Elegí qué dibujar.');
    expect(n.data.onActionClick.default.url).toBe('/elegir');
  });

  it('va con TTL de 24 h y el topic de la sala', async () => {
    await mandarDibujo();
    await t.esperarAvisos();
    const sala = await t.prisma.sala.findFirstOrThrow();
    expect(avisosA('celu-ana')[0].opciones).toEqual({ ttlSegundos: 86_400, topic: sala.id.replace(/-/g, '') });
  });

  it.each([404, 410])('si el servicio de push responde %i, la suscripción se borra', async (codigo) => {
    t.enviador.respuestas.set(`${FCM}celu-ana`, codigo);
    await mandarDibujo();
    await t.esperarAvisos();
    const quedan = await t.prisma.suscripcionPush.findMany({ where: { jugadorId: ana.jugador.id } });
    expect(quedan.map((s) => s.endpoint)).toEqual([`${FCM}tablet-ana`]);
  });

  it.each([
    ['un 500', 500],
    ['un 429', 429],
    ['un error de red', 'tira' as const],
  ])('con %s, la suscripción queda', async (_, respuesta) => {
    t.enviador.respuestas.set(`${FCM}celu-ana`, respuesta);
    await mandarDibujo();
    await t.esperarAvisos();
    expect(await t.prisma.suscripcionPush.count({ where: { jugadorId: ana.jugador.id } })).toBe(2);
  });

  it('si el envío falla o no responde, el juego sigue igual y responde enseguida', async () => {
    t.enviador.respuestas.set(`${FCM}celu-ana`, 'colgado');
    t.enviador.respuestas.set(`${FCM}tablet-ana`, 'tira');
    const inicio = Date.now();
    await mandarDibujo();
    expect(Date.now() - inicio).toBeLessThan(2000);
    expect((await ana.get('/api/estado').expect(200)).body.turno).toMatchObject({ rol: 'adivina', estado: 'adivinando' });

    // Y el resto del juego también.
    t.enviador.respuestas.set(`${FCM}celu-juan`, 'tira');
    await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'mate' }).expect(200);
    expect((await ana.get('/api/estado').expect(200)).body.turno).toMatchObject({ numero: 2, rol: 'dibuja' });
    await t.esperarAvisos(); // el colgado termina por el tiempo máximo de 10 s
  }, 20_000);

  it('quien no tiene suscripciones no recibe nada y no pasa nada', async () => {
    await t.prisma.suscripcionPush.deleteMany({ where: { jugadorId: ana.jugador.id } });
    await mandarDibujo();
    await t.esperarAvisos();
    expect(t.enviador.enviados).toHaveLength(0);
  });

  it('con los avisos apagados (sin VAPID), no se manda nada', async () => {
    const apagada = await crearAppDeTest();
    try {
      await limpiar(apagada.prisma);
      const [j, a] = (await salaCon(apagada, 'Juan', 'Ana')).personas;
      await request(apagada.app.getHttpServer()).post('/api/push/suscripciones').set('Authorization', `Bearer ${a.token}`).send({ endpoint: `${FCM}x`, keys: claves }).expect(204);
      const id = (await j.get('/api/estado')).body.turno.id;
      await j.post(`/api/turnos/${id}/palabra`, { propia: 'Mate' }).expect(200);
      await j.post(`/api/turnos/${id}/dibujo`, { trazos: dibujo }).expect(200);
      await apagada.esperarAvisos();
      expect(apagada.enviador.enviados).toHaveLength(0);
    } finally {
      await apagada.app.close();
    }
  });
});
