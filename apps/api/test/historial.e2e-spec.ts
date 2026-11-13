import type { ItemHistorial } from '@garabato/shared';
import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';
import { POR_PAGINA } from '../src/historial/historial.service.js';

const dibujo = [{ color: '#1B2A7A', width: 0.02, points: [{ x: 0.1, y: 0.1, t: 0 }, { x: 0.5, y: 0.5, t: 100 }] }];

describe('Historial', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  const historial = async (p: Persona, consulta = '') => (await p.get(`/api/historial${consulta}`).expect(200)).body;
  const resumen = (items: ItemHistorial[]) => items.map((i) => (i.tipo === 'juego' ? `${i.palabra} (${i.resultado})` : `libre de ${i.autor}`));

  /** Quien dibuja manda `palabra`; la otra persona la adivina o se rinde. */
  async function unTurno(palabra: string, final: 'adivina' | 'rinde' = 'adivina') {
    const { turno } = await estado(juan);
    const [dibuja, adivina] = turno.rol === 'dibuja' ? [juan, ana] : [ana, juan];
    await dibuja.post(`/api/turnos/${turno.id}/palabra`, { propia: palabra }).expect(200);
    await dibuja.post(`/api/turnos/${turno.id}/dibujo`, { trazos: dibujo }).expect(200);
    t.reloj.avanzarMinutos(1);
    if (final === 'adivina') await adivina.post(`/api/turnos/${turno.id}/intentos`, { texto: palabra }).expect(200);
    else await adivina.post(`/api/turnos/${turno.id}/rendirse`).expect(200);
    t.reloj.avanzarMinutos(1);
  }
  async function unLibre(p: Persona) {
    await p.post('/api/libres', { trazos: dibujo }).expect(201);
    t.reloj.avanzarMinutos(1);
  }

  beforeAll(async () => {
    t = await crearAppDeTest();
  });
  beforeEach(async () => {
    t.reloj.reiniciar();
    await limpiar(t.prisma);
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
  });
  afterAll(() => t.app.close());

  it('junta turnos terminados y dibujos libres, del más nuevo al más viejo', async () => {
    await unTurno('Mate');
    await unLibre(ana);
    await unTurno('Faro', 'rinde');
    const r = await historial(juan);
    expect(resumen(r.items)).toEqual(['Faro (rendido)', 'libre de Ana', 'Mate (adivinado)']);
    expect(r.siguiente).toBeNull();
    expect(r.items[2]).toMatchObject({ tipo: 'juego', autor: 'Juan', mio: true, intentos: 1, trazos: dibujo });
    expect(r.items[1]).toMatchObject({ tipo: 'libre', mio: false });
  });

  it('el turno en curso no aparece: su palabra todavía es secreta', async () => {
    const { turno } = await estado(juan);
    await juan.post(`/api/turnos/${turno.id}/palabra`, { propia: 'Secreto' }).expect(200);
    await juan.post(`/api/turnos/${turno.id}/dibujo`, { trazos: dibujo }).expect(200);
    const crudo = (await ana.get('/api/historial').expect(200)).text;
    expect(crudo).not.toMatch(/secreto/i);
  });

  it('filtra por juego o libres', async () => {
    await unTurno('Mate');
    await unLibre(juan);
    expect(resumen((await historial(ana, '?filtro=juego')).items)).toEqual(['Mate (adivinado)']);
    expect(resumen((await historial(ana, '?filtro=libres')).items)).toEqual(['libre de Juan']);
  });

  it('pagina sin repetir ni saltear', async () => {
    for (let i = 0; i < POR_PAGINA + 3; i++) {
      if (i % 3 === 0) await unLibre(juan);
      else await unTurno(`Palabra ${i}`, i % 3 === 2 ? 'rinde' : 'adivina');
    }
    const primera = await historial(juan);
    expect(primera.items).toHaveLength(POR_PAGINA);
    expect(primera.siguiente).not.toBeNull();
    const segunda = await historial(juan, `?antes=${encodeURIComponent(primera.siguiente)}`);
    expect(segunda.siguiente).toBeNull();
    const ids = [...primera.items, ...segunda.items].map((i: ItemHistorial) => i.id);
    expect(new Set(ids).size).toBe(POR_PAGINA + 3);
  });

  it('nadie de otra sala ve el historial', async () => {
    await unTurno('Mate');
    const [otro] = (await salaCon(t, 'Otro', 'Otra')).personas;
    expect((await historial(otro)).items).toEqual([]);
  });

  it('valida la consulta', async () => {
    await juan.get('/api/historial?filtro=raro').expect(400);
    await juan.get('/api/historial?antes=ayer').expect(400);
  });
});
