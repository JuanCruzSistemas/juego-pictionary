import { Module } from '@nestjs/common';
import { PrismaModule } from './db/prisma.module.js';
import { RelojModule } from './comun/reloj.js';
import { TurnosModule } from './turnos/turnos.module.js';
import { HealthModule } from './health/health.module.js';
import { SalasModule } from './salas/salas.module.js';
import { EstadoModule } from './estado/estado.module.js';

@Module({
  imports: [PrismaModule, RelojModule, TurnosModule, HealthModule, SalasModule, EstadoModule],
})
export class AppModule {}
