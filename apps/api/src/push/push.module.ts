import { Module } from '@nestjs/common';
import { PushController } from './push.controller.js';
import { ConfigPush } from './config.js';
import { EnviadorPush, EnviadorWebPush } from './enviador.js';
import { NotificacionesService } from './notificaciones.service.js';

@Module({
  controllers: [PushController],
  providers: [ConfigPush, { provide: EnviadorPush, useClass: EnviadorWebPush }, NotificacionesService],
  exports: [ConfigPush, NotificacionesService],
})
export class PushModule {}
