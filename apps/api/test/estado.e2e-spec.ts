import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { salaCon } from './util/sala-de-test.js';
import { seParecen } from '../src/turnos/sorteo.js';
import { PALABRAS_BASE } from '../prisma/palabras-base.js';

describe('GET /api/estado con turnos', () => {
  let t: AppDeTest;

  beforeAll(async () => {
    t = await crearAppDeTest();
  });
  beforeEach(() => limpiar(t.prisma));
  afterAll(() => t.app.close());

  it('con una sola persona no hay turno', async () => {
    const { personas: [juan] } = await salaCon(t, 'Juan');
    const r = await juan.get('/api/estado').expect(200);
    expect(r.body.turno).toBeNull();
    expect(await t.prisma.turno.count()).toBe(0);
  });

  it('al entrar la segunda persona se crea el turno 1, y lo dibuja quien entró primero', async () => {
    const { personas: [juan, ana] } = await salaCon(t, 'Juan', 'Ana');

    const turnos = await t.prisma.turno.findMany();
    expect(turnos).toHaveLength(1);
    expect(turnos[0]).toMatchObject({ numero: 1, dibujaId: juan.jugador.id, adivinaId: ana.jugador.id });

    const deJuan = (await juan.get('/api/estado').expect(200)).body;
    expect(deJuan.turno).toMatchObject({ numero: 1, rol: 'dibuja', estado: 'eligiendo', intentos: 0 });
    expect(deJuan.anterior).toBeNull();

    const deAna = (await ana.get('/api/estado').expect(200)).body;
    expect(deAna.turno).toEqual({ id: deJuan.turno.id, numero: 1, rol: 'adivina', estado: 'eligiendo', intentos: 0, pistas: 0 });
  });

  it('una sala llena sin turno (gente que entró antes del paso 4) recibe el turno 1 al pedir el estado', async () => {
    // Reproduce la sala dIYr…: dos personas y ningún turno. Antes /estado devolvía turno null
    // y la tarjeta mostraba "Esperando que entre" con la sala llena.
    const { personas: [juan, ana] } = await salaCon(t, 'Juan', 'Ana');
    await t.prisma.turno.deleteMany();

    const deAna = (await ana.get('/api/estado').expect(200)).body;
    expect(deAna.otro).toEqual(juan.jugador);
    expect(deAna.turno).toMatchObject({ numero: 1, rol: 'adivina', estado: 'eligiendo' });

    const deJuan = (await juan.get('/api/estado').expect(200)).body;
    expect(deJuan.turno).toMatchObject({ numero: 1, rol: 'dibuja' });
    expect(deJuan.turno.opciones).toHaveLength(3);
  });

  it('si las dos personas piden el estado a la vez, se crea un solo turno 1', async () => {
    const { personas: [juan, ana] } = await salaCon(t, 'Juan', 'Ana');
    await t.prisma.turno.deleteMany();

    const r = await Promise.all([juan.get('/api/estado'), ana.get('/api/estado'), juan.get('/api/estado')]);
    expect(r.map((x) => x.status)).toEqual([200, 200, 200]);
    expect(new Set(r.map((x) => x.body.turno?.id)).size).toBe(1);
    expect(await t.prisma.turno.count()).toBe(1);
  });

  it('las 3 opciones son de la lista base y no se parecen entre sí', async () => {
    const { personas: [juan] } = await salaCon(t, 'Juan', 'Ana');
    const { opciones } = (await juan.get('/api/estado').expect(200)).body.turno as { opciones: string[] };
    expect(opciones).toHaveLength(3);
    for (const o of opciones) expect(PALABRAS_BASE).toContain(o);
    expect(seParecen(opciones[0], opciones[1]) || seParecen(opciones[0], opciones[2]) || seParecen(opciones[1], opciones[2])).toBe(false);
  });

  it.each(['eligiendo', 'dibujando', 'adivinando'] as const)(
    'quien adivina no recibe la palabra ni las opciones (turno %s)',
    async (estado) => {
      const { personas: [juan, ana] } = await salaCon(t, 'Juan', 'Ana');
      const turno = await t.prisma.turno.findFirstOrThrow();
      await t.prisma.turno.update({
        where: { id: turno.id },
        data: { estado, palabra: 'Zeppelin', palabraNormalizada: 'zeppelin', origen: 'propia' },
      });

      const crudo = (await ana.get('/api/estado').expect(200)).text;
      expect(crudo).not.toMatch(/zeppelin/i);
      for (const o of turno.opciones) expect(crudo).not.toContain(o);
      const deAna = JSON.parse(crudo);
      expect(deAna.turno).not.toHaveProperty('palabra');
      expect(deAna.turno).not.toHaveProperty('opciones');

      const deJuan = (await juan.get('/api/estado').expect(200)).body;
      expect(deJuan.turno.palabra).toBe('Zeppelin');
    },
  );

  it('cuenta los intentos e informa cómo terminó el turno anterior', async () => {
    const { sala, personas: [juan, ana] } = await salaCon(t, 'Juan', 'Ana');
    const t1 = await t.prisma.turno.findFirstOrThrow();
    await t.prisma.turno.update({ where: { id: t1.id }, data: { estado: 'adivinado', palabra: 'Mate' } });
    const t2 = await t.prisma.turno.create({
      data: { salaId: sala.id, numero: 2, dibujaId: ana.jugador.id, adivinaId: juan.jugador.id, opciones: ['Sol', 'Tren', 'Gato'], estado: 'adivinando', palabra: 'Sol' },
    });
    await t.prisma.intento.createMany({
      data: [
        { turnoId: t2.id, jugadorId: juan.jugador.id, texto: 'Luna', correcto: false },
        { turnoId: t2.id, jugadorId: juan.jugador.id, texto: 'Estrella', correcto: false },
      ],
    });

    const deAna = (await ana.get('/api/estado').expect(200)).body;
    expect(deAna.turno).toMatchObject({ numero: 2, rol: 'dibuja', estado: 'adivinando', intentos: 2 });
    expect(deAna.turno).not.toHaveProperty('opciones');
    expect(deAna.anterior).toEqual({ resultado: 'adivinado', dibuje: false });

    const deJuan = (await juan.get('/api/estado').expect(200)).body;
    expect(deJuan.turno).toMatchObject({ rol: 'adivina', intentos: 2 });
    expect(deJuan.anterior).toEqual({ resultado: 'adivinado', dibuje: true });
  });
});
