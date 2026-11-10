import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service.js';
import { TurnosController } from './turnos.controller.js';
import { PushModule } from '../push/push.module.js';

@Module({ imports: [PushModule], controllers: [TurnosController], providers: [TurnosService], exports: [TurnosService] })
export class TurnosModule {}
