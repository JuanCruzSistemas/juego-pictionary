import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);

  // En local el front pasa por el proxy de ng serve; en producción viene de otro dominio.
  if (process.env.WEB_ORIGIN) {
    app.enableCors({ origin: process.env.WEB_ORIGIN });
  }

  // 0.0.0.0 para que la API también responda por la red local.
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
