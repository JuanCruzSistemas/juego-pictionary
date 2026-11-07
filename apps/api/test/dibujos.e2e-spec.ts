import request from 'supertest';
import type { Stroke } from '@garabato/shared';
import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

/** Un dibujo de `n` puntos repartidos en trazos de hasta 500. */
function dibujoDe(n: number): Stroke[] {
  const trazos: Stroke[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 500 === 0) trazos.push({ color: '#1B2A7A', width: 0.02, points: [] });
    trazos.at(-1)!.points.push({ x: 0.1234 + (i % 100) / 200, y: 0.5678 + (i % 50) / 200, t: 10000 + i * 8 });
  }
  return trazos;
}

describe('POST y GET /api/turnos/:id/dibujo', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;
  let turnoId: string;

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  const enviar = (p: Persona, trazos: unknown) => p.post(`/api/turnos/${turnoId}/dibujo`, { trazos });
  const simple: Stroke[] = [
    { color: '#1B2A7A', width: 0.02, points: [{ x: 0.1, y: 0.1, t: 0 }, { x: 0.5, y: 0.5, t: 120 }] },
    { color: '#FFFFFF', width: 0.04, points: [{ x: 0.3, y: 0.3, t: 900 }] },
  ];

  beforeAll(async () => {
    t = await crearAppDeTest();
  });
  beforeEach(async () => {
    t.reloj.reiniciar();
    await limpiar(t.prisma);
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
    turnoId = (await estado(juan)).turno.id;
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
  });
  afterAll(() => t.app.close());

  it('guarda el dibujo y pasa el turno a adivinando', async () => {
    const r = await enviar(juan, simple).expect(200);
    expect(r.body.turno).toMatchObject({ id: turnoId, rol: 'dibuja', estado: 'adivinando', palabra: 'Mate' });

    const db = await t.prisma.turno.findUniqueOrThrow({ where: { id: turnoId }, include: { dibujo: true } });
    expect(db.estado).toBe('adivinando');
    expect(db.enviadoEn).toEqual(new Date('2026-11-07T13:00:00.000Z'));
    expect(db.dibujo).toMatchObject({ autorId: juan.jugador.id, duracionMs: 900, trazos: simple });

    expect((await estado(juan)).turno).toMatchObject({ estado: 'adivinando', intentos: 0 });
    expect((await estado(ana)).turno).toMatchObject({ rol: 'adivina', estado: 'adivinando' });
  });

  it('quien adivina recibe los trazos, sin la palabra', async () => {
    await enviar(juan, simple).expect(200);
    const r = await ana.get(`/api/turnos/${turnoId}/dibujo`).expect(200);
    expect(r.body).toEqual({ trazos: simple, duracionMs: 900 });
    expect(r.text).not.toMatch(/mate/i);
  });

  it('antes de mandarlo, el dibujo no está disponible', async () => {
    const r = await ana.get(`/api/turnos/${turnoId}/dibujo`).expect(404);
    expect(r.body.codigo).toBe('dibujo_no_disponible');
  });

  it('es idempotente: mandarlo dos veces deja un solo dibujo, el primero', async () => {
    await enviar(juan, simple).expect(200);
    const otro: Stroke[] = [{ color: '#D6293E', width: 0.02, points: [{ x: 0.9, y: 0.9, t: 0 }] }];
    const r = await enviar(juan, otro).expect(200);
    expect(r.body.turno).toMatchObject({ estado: 'adivinando' });
    expect(await t.prisma.dibujo.count()).toBe(1);
    expect((await ana.get(`/api/turnos/${turnoId}/dibujo`)).body.trazos).toEqual(simple);
  });

  it('tres envíos a la vez dejan un solo dibujo y ninguno falla', async () => {
    const r = await Promise.all([enviar(juan, simple), enviar(juan, simple), enviar(juan, simple)]);
    expect(r.map((x) => x.status)).toEqual([200, 200, 200]);
    expect(await t.prisma.dibujo.count()).toBe(1);
  });

  it('acepta un dibujo de 150 KB', async () => {
    const trazos = dibujoDe(4500);
    const kb = Buffer.byteLength(JSON.stringify({ trazos })) / 1024;
    expect(kb).toBeGreaterThan(150);
    await enviar(juan, trazos).expect(200);
    expect((await ana.get(`/api/turnos/${turnoId}/dibujo`)).body.trazos).toEqual(trazos);
  });

  it('rechaza con 413 y un mensaje claro un body de más de 1 MB', async () => {
    const enorme = [{ color: '#1B2A7A', width: 0.02, points: [{ x: 0.5, y: 0.5, t: 0 }], relleno: 'x'.repeat(1.1 * 1024 * 1024) }];
    const r = await enviar(juan, enorme).expect(413);
    expect(r.body).toEqual({ codigo: 'datos_invalidos', mensaje: 'El dibujo es demasiado grande para mandarlo.' });
  });

  it.each([
    ['sin trazos', [], 'El dibujo no tiene trazos.'],
    ['20.001 puntos', dibujoDe(20_001), 'El dibujo tiene más de 20.000 puntos.'],
    ['color fuera de la paleta', [{ color: 'red', width: 0.02, points: [{ x: 0, y: 0, t: 0 }] }], 'Trazo 1: el color "red" no es de la paleta.'],
    ['x fuera de rango', [{ color: '#111111', width: 0.02, points: [{ x: 2, y: 0, t: 0 }] }], 'Trazo 1, punto 1: x tiene que estar entre 0 y 1.'],
  ])('rechaza con 400: %s', async (_, trazos, mensaje) => {
    const r = await enviar(juan, trazos).expect(400);
    expect(r.body).toEqual({ codigo: 'datos_invalidos', mensaje });
    expect((await t.prisma.turno.findUniqueOrThrow({ where: { id: turnoId } })).estado).toBe('dibujando');
  });

  it('un JSON roto da 400 con la forma de siempre', async () => {
    const r = await request(t.app.getHttpServer())
      .post(`/api/turnos/${turnoId}/dibujo`)
      .set('Authorization', `Bearer ${juan.token}`)
      .set('Content-Type', 'application/json')
      .send('{"trazos": [')
      .expect(400);
    expect(r.body).toEqual({ codigo: 'datos_invalidos', mensaje: 'Los datos no llegaron bien. Probá de nuevo.' });
  });

  it('rechaza un body sin trazos o con campos de más', async () => {
    await juan.post(`/api/turnos/${turnoId}/dibujo`, {}).expect(400);
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: simple, duracionMs: 5 }).expect(400);
  });

  it('quien adivina no puede mandarlo', async () => {
    expect((await enviar(ana, simple).expect(403)).body.codigo).toBe('no_es_tu_turno');
  });

  it('sin palabra elegida no se puede mandar', async () => {
    await limpiar(t.prisma);
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
    turnoId = (await estado(juan)).turno.id;
    const r = await enviar(juan, simple).expect(409);
    expect(r.body).toEqual({ codigo: 'turno_cerrado', mensaje: 'Elegí la palabra antes de mandar el dibujo.' });
  });

  it('después de mandarlo, no se puede saltear ni cambiar la palabra', async () => {
    await enviar(juan, simple).expect(200);
    expect((await juan.post(`/api/turnos/${turnoId}/salteo`).expect(409)).body.codigo).toBe('turno_cerrado');
    expect((await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Otra' }).expect(409)).body.codigo).toBe('turno_cerrado');
    expect(await t.prisma.salteo.count()).toBe(0);
  });

  it('un turno de otra sala no existe para quien pide', async () => {
    const [intrusa] = (await salaCon(t, 'Intrusa')).personas;
    await intrusa.post(`/api/turnos/${turnoId}/dibujo`, { trazos: simple }).expect(404);
    await intrusa.get(`/api/turnos/${turnoId}/dibujo`).expect(404);
  });
});
