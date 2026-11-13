import { Module } from '@nestjs/common';
import { EstadoController } from './estado.controller.js';
import { TurnosModule } from '../turnos/turnos.module.js';
import { LibresModule } from '../libres/libres.module.js';
import { VivoBaseModule } from '../vivo/vivo-base.module.js';

@Module({ imports: [TurnosModule, LibresModule, VivoBaseModule], controllers: [EstadoController] })
export class EstadoModule {}
