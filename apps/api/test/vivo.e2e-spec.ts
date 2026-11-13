import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import type { EventosAlCliente, EventosAlServidor, Stroke, Vivo } from '@garabato/shared';
import { crearAppDeTest, limpiar, PUSH_ACTIVO, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';
import { VivoRegistro } from '../src/vivo/vivo.registro.js';

type Cliente = Socket<EventosAlCliente, EventosAlServidor>;
const FCM = 'https://fcm.googleapis.com/fcm/send/';
const claves = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const trazo: Stroke = { color: '#1B2A7A', width: 0.02, points: [{ x: 0.1, y: 0.1, t: 0 }] };

describe('Modo en vivo', () => {
  let t: AppDeTest;
  let url: string;
  let juan: Persona;
  let ana: Persona;
  let turnoId: string;
  const abiertos: Cliente[] = [];

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  /** Espera el próximo evento `nombre` del socket que cumpla `condicion`. */
  function esperar<E extends keyof EventosAlCliente>(s: Cliente, nombre: E, condicion: (...a: Parameters<EventosAlCliente[E]>) => boolean = () => true) {
    return new Promise<Parameters<EventosAlCliente[E]>>((resolver, rechazar) => {
      const plazo = setTimeout(() => rechazar(new Error(`No llegó ${String(nombre)}`)), 3000);
      const oyente = (...a: Parameters<EventosAlCliente[E]>) => {
        if (!condicion(...a)) return;
        clearTimeout(plazo);
        s.off(nombre, oyente as never);
        resolver(a);
      };
      s.on(nombre, oyente as never);
    });
  }
  const conEstado = (s: Cliente, e: Vivo['estado'] | null) => esperar(s, 'vivo:estado', (v) => (v?.estado ?? null) === e);
  function conectar(p: Persona | { token: string }): Cliente {
    const s: Cliente = io(url, { auth: { token: p.token }, transports: ['websocket'], forceNew: true, reconnection: false, autoConnect: false });
    abiertos.push(s);
    // Los oyentes se ponen antes de conectar, así no se pierde el primer evento.
    queueMicrotask(() => s.connect());
    return s;
  }
  /** Listo = llegó el primer vivo:estado: el servidor ya validó la sesión. */
  const conectado = (s: Cliente) => new Promise<void>((r) => s.once('vivo:estado', () => r()));
  /** Juan invita y Ana entra: partida activa. */
  async function partidaActiva(): Promise<[Cliente, Cliente]> {
    const sj = conectar(juan);
    await conectado(sj);
    const esperando = conEstado(sj, 'esperando');
    sj.emit('vivo:invitar');
    await esperando;
    const activaJuan = conEstado(sj, 'activa');
    const sa = conectar(ana);
    await Promise.all([activaJuan, conEstado(sa, 'activa')]);
    return [sj, sa];
  }

  beforeAll(async () => {
    t = await crearAppDeTest({ push: PUSH_ACTIVO });
    await t.app.listen(0);
    url = `http://127.0.0.1:${((t.app.getHttpServer() as unknown as Server).address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    t.reloj.reiniciar();
    await limpiar(t.prisma);
    t.enviador.enviados = [];
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
    turnoId = (await estado(juan)).turno.id;
  });
  afterEach(() => {
    for (const s of abiertos.splice(0)) s.disconnect();
  });
  afterAll(() => t.app.close());

  it('sin una sesión válida, el socket se corta', async () => {
    const s = conectar({ token: 'cualquiera' });
    const [mensaje] = await esperar(s, 'vivo:error');
    expect(mensaje).toBe('No encontramos tu sesión en este dispositivo.');
  });

  it('invitar avisa a la otra persona y, cuando entra, la partida queda activa', async () => {
    await request(t.app.getHttpServer())
      .post('/api/push/suscripciones')
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ endpoint: `${FCM}celu-ana`, keys: claves })
      .expect(204);
    const sj = conectar(juan);
    await conectado(sj);
    const esperando = conEstado(sj, 'esperando');
    sj.emit('vivo:invitar');
    expect((await esperando)[0]).toMatchObject({ invitadorId: juan.jugador.id, presentes: [juan.jugador.id] });
    await t.esperarAvisos();
    expect(t.enviador.enviados.map((e) => e.payload.notification.title)).toEqual(['¿Jugamos en vivo?']);
    expect((await estado(ana)).vivo).toMatchObject({ estado: 'esperando' });

    const activa = conEstado(sj, 'activa');
    conectar(ana);
    await activa;
    expect((await estado(ana)).vivo).toMatchObject({ estado: 'activa', presentes: expect.arrayContaining([juan.jugador.id, ana.jugador.id]) });
  });

  it('los trazos llegan en el momento, y se puede adivinar mientras se dibuja', async () => {
    const [sj, sa] = await partidaActiva();
    const cambio = esperar(sa, 'vivo:cambio');
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    await cambio;

    // Sin nada dibujado todavía, no se puede adivinar.
    expect((await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'taza' }).expect(409)).body.mensaje).toBe('Esperá a que empiece a dibujar.');

    const inicio = esperar(sa, 'trazo:inicio');
    sj.emit('trazo:inicio', { turnoId, indice: 0, trazo });
    expect((await inicio)[0]).toEqual({ turnoId, indice: 0, trazo });
    const puntos = esperar(sa, 'trazo:puntos');
    sj.emit('trazo:puntos', { turnoId, indice: 0, puntos: [{ x: 0.5, y: 0.5, t: 80 }] });
    await puntos;

    expect((await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'taza' }).expect(200)).body.resultado).toBe('incorrecto');
    await ana.post(`/api/turnos/${turnoId}/pistas`, { texto: 'Es verde' }).expect(403); // las pistas las manda quien dibuja
    await juan.post(`/api/turnos/${turnoId}/pistas`, { texto: 'Es verde' }).expect(200);
    expect((await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'mate' }).expect(200)).body).toMatchObject({ resultado: 'correcto', palabra: 'Mate' });

    // Se guarda lo dibujado hasta ese momento y el turno siguiente lo dibuja Ana.
    const db = await t.prisma.turno.findUniqueOrThrow({ where: { id: turnoId }, include: { dibujo: true } });
    expect(db.estado).toBe('adivinado');
    expect(db.dibujo?.trazos).toEqual([{ ...trazo, points: [...trazo.points, { x: 0.5, y: 0.5, t: 80 }] }]);
    expect((await estado(ana)).turno).toMatchObject({ numero: 2, rol: 'dibuja', estado: 'eligiendo' });
    expect((await estado(ana)).vivo).toMatchObject({ estado: 'activa' });
  });

  it('rendirse también vale mientras se dibuja', async () => {
    const [sj, sa] = await partidaActiva();
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    const inicio = esperar(sa, 'trazo:inicio');
    sj.emit('trazo:inicio', { turnoId, indice: 0, trazo });
    await inicio;
    expect((await ana.post(`/api/turnos/${turnoId}/rendirse`).expect(200)).body).toEqual({ turnoId, palabra: 'Mate' });
    expect(await t.prisma.dibujo.count({ where: { turnoId } })).toBe(1);
  });

  it('quien adivina no puede dibujar, y un trazo inválido no se reenvía', async () => {
    const [sj, sa] = await partidaActiva();
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    sa.emit('trazo:inicio', { turnoId, indice: 0, trazo });
    sj.emit('trazo:inicio', { turnoId, indice: 0, trazo: { ...trazo, color: 'red' } });
    await new Promise((r) => setTimeout(r, 200));
    expect(t.app.get(VivoRegistro).trazosDe((await t.prisma.turno.findUniqueOrThrow({ where: { id: turnoId } })).salaId, turnoId)).toEqual([]);
  });

  it('quien llega a mitad del dibujo lo recibe entero', async () => {
    const [sj, sa] = await partidaActiva();
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    const inicio = esperar(sa, 'trazo:inicio');
    sj.emit('trazo:inicio', { turnoId, indice: 0, trazo });
    await inicio;
    sa.disconnect();
    const otra = conectar(ana);
    const [todos] = await esperar(otra, 'trazos:todos');
    expect(todos).toEqual({ turnoId, trazos: [trazo] });
  });

  it('si alguien se va, la partida se pausa; si vuelve, sigue; "Terminar" la cierra', async () => {
    const [sj, sa] = await partidaActiva();
    const pausada = conEstado(sj, 'pausada');
    sa.disconnect();
    await pausada;
    const activa = conEstado(sj, 'activa');
    conectar(ana);
    await activa;
    const fin = conEstado(sj, null);
    sj.emit('vivo:terminar');
    await fin;
    expect((await estado(juan)).vivo).toBeNull();
  });

  it('sin partida en vivo, no se puede adivinar mientras se dibuja', async () => {
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    await ana.post(`/api/turnos/${turnoId}/intentos`, { texto: 'mate' }).expect(409);
  });

  it('no se puede invitar con un dibujo esperando que lo adivinen', async () => {
    await juan.post(`/api/turnos/${turnoId}/palabra`, { propia: 'Mate' }).expect(200);
    await juan.post(`/api/turnos/${turnoId}/dibujo`, { trazos: [trazo] }).expect(200);
    const sj = conectar(juan);
    await conectado(sj);
    const error = esperar(sj, 'vivo:error');
    sj.emit('vivo:invitar');
    expect((await error)[0]).toBe('Hay un dibujo esperando que lo adivinen: terminen ese turno primero.');
  });
});
