import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

describe('Palabras propias', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;

  const sumar = (p: Persona, texto: unknown) => p.post('/api/palabras', { texto });

  beforeAll(async () => {
    t = await crearAppDeTest();
  });
  beforeEach(async () => {
    t.reloj.reiniciar();
    await limpiar(t.prisma);
    [juan, ana] = (await salaCon(t, 'Juan', 'Ana')).personas;
  });
  afterAll(() => t.app.close());

  it('las dos personas suman y ven las mismas palabras, la más nueva arriba', async () => {
    await sumar(juan, '  Patineta de Pili ').expect(201);
    const r = await sumar(ana, 'Mesa de luz').expect(201);
    expect(r.body.map((p: { texto: string }) => p.texto)).toEqual(['Mesa de luz', 'Patineta de Pili']);
    expect((await juan.get('/api/palabras').expect(200)).body).toEqual(r.body);
  });

  it('no repite una palabra que ya está, en la sala o en la lista base', async () => {
    await sumar(juan, 'Patineta de Pili').expect(201);
    expect((await sumar(ana, 'patineta de PILI').expect(400)).body.mensaje).toBe('Esa palabra ya está en el juego.');
    expect((await sumar(ana, 'MATÉ').expect(400)).body.mensaje).toBe('Esa palabra ya está en el juego.');
  });

  it('valida el texto', async () => {
    expect((await sumar(juan, '   ').expect(400)).body.mensaje).toBe('Escribí una palabra.');
    expect((await sumar(juan, 'a'.repeat(41)).expect(400)).body.mensaje).toBe('Usá 40 caracteres como máximo.');
  });

  it('se puede sacar una propia, pero no una base ni una de otra sala', async () => {
    const [p] = (await sumar(juan, 'Patineta de Pili').expect(201)).body;
    const [otro] = (await salaCon(t, 'Otro', 'Otra')).personas;
    expect((await otro.delete(`/api/palabras/${p.id}`).expect(404)).body.codigo).toBe('palabra_no_encontrada');
    const base = await t.prisma.palabra.findFirstOrThrow({ where: { salaId: null } });
    await juan.delete(`/api/palabras/${base.id}`).expect(404);
    expect((await ana.delete(`/api/palabras/${p.id}`).expect(200)).body).toEqual([]);
  });

  it('las palabras propias entran al sorteo de los turnos nuevos', async () => {
    await sumar(juan, 'Patineta de Pili').expect(201);
    let vista = false;
    for (let i = 0; i < 30 && !vista; i++) {
      const { turno } = (await juan.get('/api/estado').expect(200)).body;
      const quien = turno.rol === 'dibuja' ? juan : ana;
      const opciones: string[] = (await quien.get('/api/estado').expect(200)).body.turno.opciones;
      vista = opciones.includes('Patineta de Pili');
      t.reloj.avanzarMinutos(31); // así nunca se quedan sin salteos
      await quien.post(`/api/turnos/${turno.id}/salteo`).expect(200);
    }
    expect(vista).toBe(true);
  });
});
