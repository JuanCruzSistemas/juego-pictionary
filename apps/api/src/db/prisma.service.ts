import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { opcionesPrisma } from './cliente.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super(opcionesPrisma());
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
