import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar.js';

const WEB = 'https://garabato.onrender.com';

describe('CORS', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(app, { webOrigin: `${WEB}/` });
    await app.init();
  });
  afterAll(() => app.close());

  const preflight = (origen: string) =>
    http()
      .options('/api/turnos/x/dibujo')
      .set('Origin', origen)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

  it('la consulta previa desde la web se permite, con Authorization y maxAge de 600 s', async () => {
    const r = await preflight(WEB).expect(204);
    expect(r.headers['access-control-allow-origin']).toBe(WEB);
    expect(r.headers['access-control-max-age']).toBe('600');
    expect(r.headers['access-control-allow-headers']).toMatch(/authorization/i);
    expect(r.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  it('desde otro origen, el navegador no recibe permiso', async () => {
    const r = await preflight('https://otro-sitio.com');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('una respuesta normal a la web lleva el origen permitido', async () => {
    const r = await http().get('/health').set('Origin', WEB).expect(200);
    expect(r.headers['access-control-allow-origin']).toBe(WEB);
  });

  it('sin WEB_ORIGIN no se habilita CORS para nadie', async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const sin = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(sin, { webOrigin: '' });
    await sin.init();
    const r = await request(sin.getHttpServer()).get('/health').set('Origin', WEB).expect(200);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
    await sin.close();
  });
});
