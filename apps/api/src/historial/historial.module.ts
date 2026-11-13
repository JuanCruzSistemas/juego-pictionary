import { Module } from '@nestjs/common';
import { HistorialController } from './historial.controller.js';
import { HistorialService } from './historial.service.js';

@Module({ controllers: [HistorialController], providers: [HistorialService] })
export class HistorialModule {}
