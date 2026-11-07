import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar.js';

describe('GET /health', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde ok fuera del prefijo /api', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ ok: true });
  });

  it('no existe con el prefijo /api', () => {
    return request(app.getHttpServer()).get('/api/health').expect(404);
  });
});
