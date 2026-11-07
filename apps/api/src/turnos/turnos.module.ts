import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service.js';

@Module({ providers: [TurnosService], exports: [TurnosService] })
export class TurnosModule {}
