import { Module } from '@nestjs/common';
import { EstadoController } from './estado.controller.js';
import { TurnosModule } from '../turnos/turnos.module.js';

@Module({ imports: [TurnosModule], controllers: [EstadoController] })
export class EstadoModule {}
