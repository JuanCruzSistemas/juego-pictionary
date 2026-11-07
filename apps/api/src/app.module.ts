import { Module } from '@nestjs/common';
import { PrismaModule } from './db/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { SalasModule } from './salas/salas.module.js';
import { EstadoModule } from './estado/estado.module.js';

@Module({
  imports: [PrismaModule, HealthModule, SalasModule, EstadoModule],
})
export class AppModule {}
