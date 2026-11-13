import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service.js';
import { TurnosController } from './turnos.controller.js';
import { PushModule } from '../push/push.module.js';
import { VivoBaseModule } from '../vivo/vivo-base.module.js';

@Module({ imports: [PushModule, VivoBaseModule], controllers: [TurnosController], providers: [TurnosService], exports: [TurnosService] })
export class TurnosModule {}
