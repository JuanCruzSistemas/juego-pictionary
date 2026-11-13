import { crearAppDeTest, limpiar, type AppDeTest } from './util/app-de-test.js';
import { salaCon, type Persona } from './util/sala-de-test.js';

const dibujo = [{ color: '#1B2A7A', width: 0.02, points: [{ x: 0.1, y: 0.1, t: 0 }, { x: 0.5, y: 0.5, t: 100 }] }];
const DIA = 24 * 60;

describe('Racha', () => {
  let t: AppDeTest;
  let juan: Persona;
  let ana: Persona;

  const estado = async (p: Persona) => (await p.get('/api/estado').expect(200)).body;
  /** Quien dibuja manda "Mate" y la otra persona lo adivina. */
  async function unAcierto() {
    const { turno } = await estado(juan);
    const [dibuja, adivina] = turno.rol === 'dibuja' ? [juan, ana] : [ana, juan];
    await dibuja.post(`/api/turnos/${turno.id}/palabra`, { propia: 'Mate' }).expect(200);
    await dibuja.post(`/api/turnos/${turno.id}/dibujo`, { trazos: dibujo }).expect(200);
    await adivina.post(`/api/turnos/${turno.id}/intentos`, { texto: 'mate' }).expect(200);
    return turno.id as string;
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

  it('suma un día por cada día con un acierto, sea de quien sea', async () => {
    expect((await estado(juan)).racha).toEqual({ dias: 0, hoy: false });
    await unAcierto();
    expect((await estado(juan)).racha).toEqual({ dias: 1, hoy: true });
    await unAcierto(); // dos aciertos el mismo día cuentan uno
    expect((await estado(ana)).racha).toEqual({ dias: 1, hoy: true });

    t.reloj.avanzarMinutos(DIA);
    expect((await estado(juan)).racha).toEqual({ dias: 1, hoy: false }); // sigue viva hasta que termine el día
    await unAcierto();
    expect((await estado(juan)).racha).toEqual({ dias: 2, hoy: true });
  });

  it('un día entero sin aciertos la corta', async () => {
    await unAcierto();
    t.reloj.avanzarMinutos(2 * DIA);
    expect((await estado(juan)).racha).toEqual({ dias: 0, hoy: false });
  });

  it('rendirse no cuenta para la racha', async () => {
    const { turno } = await estado(juan);
    await juan.post(`/api/turnos/${turno.id}/palabra`, { propia: 'Mate' }).expect(200);
    await juan.post(`/api/turnos/${turno.id}/dibujo`, { trazos: dibujo }).expect(200);
    await ana.post(`/api/turnos/${turno.id}/rendirse`).expect(200);
    expect((await estado(juan)).racha).toEqual({ dias: 0, hoy: false });
  });

  it('el resumen del acierto trae la racha y las pistas', async () => {
    const id = await unAcierto();
    expect((await ana.get(`/api/turnos/${id}/resumen`).expect(200)).body).toMatchObject({ racha: { dias: 1, hoy: true }, pistas: 0 });
  });
});
