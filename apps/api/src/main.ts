import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar.js';

// En local las variables vienen de apps/api/.env; en producción, del entorno.
if (existsSync('.env')) process.loadEnvFile('.env');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);

  // En local el front pasa por el proxy de ng serve; en producción viene de otro dominio.
  if (process.env.WEB_ORIGIN) {
    app.enableCors({ origin: process.env.WEB_ORIGIN });
  }

  // 0.0.0.0 para que la API también responda por la red local.
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
