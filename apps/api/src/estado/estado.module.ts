import { Module } from '@nestjs/common';
import { EstadoController } from './estado.controller.js';
import { TurnosModule } from '../turnos/turnos.module.js';
import { LibresModule } from '../libres/libres.module.js';

@Module({ imports: [TurnosModule, LibresModule], controllers: [EstadoController] })
export class EstadoModule {}
