import { Module } from '@nestjs/common';
import { PrismaModule } from './db/prisma.module.js';
import { RelojModule } from './comun/reloj.js';
import { TurnosModule } from './turnos/turnos.module.js';
import { PushModule } from './push/push.module.js';
import { HealthModule } from './health/health.module.js';
import { SalasModule } from './salas/salas.module.js';
import { EstadoModule } from './estado/estado.module.js';
import { LibresModule } from './libres/libres.module.js';
import { PalabrasModule } from './palabras/palabras.module.js';
import { HistorialModule } from './historial/historial.module.js';

@Module({
  imports: [PrismaModule, RelojModule, TurnosModule, PushModule, HealthModule, SalasModule, EstadoModule, LibresModule, PalabrasModule, HistorialModule],
})
export class AppModule {}
