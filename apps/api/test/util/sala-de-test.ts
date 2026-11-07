import request from 'supertest';
import type { JugadorPublico } from '@garabato/shared';
import { generarToken } from '../../src/sesion/tokens.js';
import type { AppDeTest } from './app-de-test.js';

export type Persona = { token: string; jugador: JugadorPublico; get: (ruta: string) => request.Test };

/** Crea una sala y hace entrar a las personas indicadas, en orden. */
export async function salaCon(t: AppDeTest, ...nombres: string[]) {
  const invitacion = generarToken();
  const sala = await t.prisma.sala.create({ data: { invitacion } });
  const personas: Persona[] = [];
  for (const nombre of nombres) {
    const r = await request(t.app.getHttpServer())
      .post(`/api/salas/${invitacion}/jugadores`)
      .send({ nombre })
      .expect(201);
    const token = r.body.token as string;
    personas.push({
      token,
      jugador: r.body.jugador,
      get: (ruta) => request(t.app.getHttpServer()).get(ruta).set('Authorization', `Bearer ${token}`),
    });
  }
  return { sala, invitacion, personas };
}
