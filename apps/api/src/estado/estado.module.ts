import { Module } from '@nestjs/common';
import { EstadoController } from './estado.controller.js';

@Module({ controllers: [EstadoController] })
export class EstadoModule {}
