import { Module } from '@nestjs/common';
import { SalasController } from './salas.controller.js';
import { SalasService } from './salas.service.js';
import { TurnosModule } from '../turnos/turnos.module.js';

@Module({ imports: [TurnosModule], controllers: [SalasController], providers: [SalasService] })
export class SalasModule {}
