import request from 'supertest';
import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

const FCM = 'https://fcm.googleapis.com/fcm/send/';
const claves = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const suscripcion = (id: string, extra: object = {}) => ({ endpoint: `${FCM}${id}`, expirationTime: null, keys: claves, ...extra });

describe('Push: clave y suscripciones', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;
  const enviar = (p: Persona, metodo: 'post' | 'delete', body: object) =>
    request(t.app.getHttpServer())[metodo]('/api/push/suscripciones').set('Authorization', `Bearer ${p.token}`).send(body);

  beforeAll(async () => {
    t = await crearAppDeTest();
  });
  beforeEach(async () => {
    await limpiar(t.prisma);
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
  });
  afterAll(() => t.app.close());

  describe('GET /api/push/clave', () => {
    it('sin claves VAPID, los avisos están apagados: null', async () => {
      await request(t.app.getHttpServer()).get('/api/push/clave').expect(200, { clavePublica: null });
    });

    it('con claves, devuelve la pública y nunca la privada (sin sesión)', async () => {
      const conClaves = await crearAppDeTest({
        push: { clavePublica: 'PUBLICA', clavePrivada: 'PRIVADA', subject: 'mailto:x@y.z', activos: true },
      });
      const r = await request(conClaves.app.getHttpServer()).get('/api/push/clave').expect(200);
      expect(r.body).toEqual({ clavePublica: 'PUBLICA' });
      expect(r.text).not.toContain('PRIVADA');
      await conClaves.app.close();
    });
  });

  describe('POST /api/push/suscripciones', () => {
    it('guarda la suscripción del dispositivo', async () => {
      await enviar(juan, 'post', suscripcion('celu-juan')).expect(204);
      const s = await t.prisma.suscripcionPush.findMany();
      expect(s).toHaveLength(1);
      expect(s[0]).toMatchObject({ jugadorId: juan.jugador.id, endpoint: `${FCM}celu-juan`, ...claves });
    });

    it('el mismo dispositivo otra vez actualiza las claves, sin duplicar', async () => {
      await enviar(juan, 'post', suscripcion('celu-juan')).expect(204);
      await enviar(juan, 'post', suscripcion('celu-juan', { keys: { ...claves, auth: 'otraClaveAuth123456789' } })).expect(204);
      const s = await t.prisma.suscripcionPush.findMany();
      expect(s).toHaveLength(1);
      expect(s[0].auth).toBe('otraClaveAuth123456789');
    });

    it('un jugador puede tener varios dispositivos', async () => {
      await enviar(juan, 'post', suscripcion('celu-juan')).expect(204);
      await enviar(juan, 'post', suscripcion('tablet-juan')).expect(204);
      expect(await t.prisma.suscripcionPush.count({ where: { jugadorId: juan.jugador.id } })).toBe(2);
    });

    it('si el dispositivo pasa a otra persona, la suscripción pasa con él', async () => {
      await enviar(juan, 'post', suscripcion('celu-compartido')).expect(204);
      await enviar(ana, 'post', suscripcion('celu-compartido')).expect(204);
      const s = await t.prisma.suscripcionPush.findMany();
      expect(s).toHaveLength(1);
      expect(s[0].jugadorId).toBe(ana.jugador.id);
    });

    it('sin sesión da 401', async () => {
      const r = await request(t.app.getHttpServer()).post('/api/push/suscripciones').send(suscripcion('x')).expect(401);
      expect(r.body.codigo).toBe('sesion_invalida');
    });

    it.each([
      ['endpoint http', { ...suscripcion('x'), endpoint: 'http://fcm.googleapis.com/fcm/send/x' }],
      ['endpoint de otro dominio', { ...suscripcion('x'), endpoint: 'https://evil.com/push' }],
      ['endpoint interno', { ...suscripcion('x'), endpoint: 'https://localhost/api/estado' }],
      ['sin claves', { endpoint: `${FCM}x` }],
      ['clave vacía', suscripcion('x', { keys: { ...claves, auth: '' } })],
      ['clave que no es base64url', suscripcion('x', { keys: { ...claves, p256dh: 'no es base64!' } })],
      ['clave demasiado larga', suscripcion('x', { keys: { ...claves, p256dh: 'A'.repeat(201) } })],
      ['campos de más en las claves', suscripcion('x', { keys: { ...claves, otra: 'x' } })],
      ['endpoint demasiado largo', { ...suscripcion('x'), endpoint: `${FCM}${'a'.repeat(2100)}` }],
    ])('rechaza: %s', async (_, body) => {
      const r = await enviar(juan, 'post', body).expect(400);
      expect(r.body.codigo).toBe('datos_invalidos');
      expect(await t.prisma.suscripcionPush.count()).toBe(0);
    });
  });

  describe('DELETE /api/push/suscripciones', () => {
    it('borra la del dispositivo de quien pide', async () => {
      await enviar(juan, 'post', suscripcion('celu-juan')).expect(204);
      await enviar(juan, 'delete', { endpoint: `${FCM}celu-juan` }).expect(204);
      expect(await t.prisma.suscripcionPush.count()).toBe(0);
    });

    it('no borra la de otra persona, y no falla', async () => {
      await enviar(juan, 'post', suscripcion('celu-juan')).expect(204);
      await enviar(ana, 'delete', { endpoint: `${FCM}celu-juan` }).expect(204);
      expect(await t.prisma.suscripcionPush.count()).toBe(1);
    });

    it('si no existe, igual responde 204', async () => {
      await enviar(juan, 'delete', { endpoint: `${FCM}nunca` }).expect(204);
    });
  });

  it('al borrar la sala se borran sus suscripciones', async () => {
    await enviar(juan, 'post', suscripcion('celu-juan')).expect(204);
    await limpiar(t.prisma);
    expect(await t.prisma.suscripcionPush.count()).toBe(0);
  });
});
